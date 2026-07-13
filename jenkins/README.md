# Jenkins Multibranch Pipelines — Setup Guide

This repo is a **monorepo** containing 3 deployable units:

| Unit                  | Path                                     | Jenkinsfile                                  |
|------------------------|--------------------------------------------|------------------------------------------------|
| student-service        | `services/student-service/`                | `services/student-service/Jenkinsfile`         |
| teacher-service        | `services/teacher-service/`                | `services/teacher-service/Jenkinsfile`         |
| attendance-service     | `services/attendance-service/`             | `services/attendance-service/Jenkinsfile`      |
| notification-service   | `services/notification-service/`           | `services/notification-service/Jenkinsfile`    |
| frontend               | `frontend/`                                 | `frontend/Jenkinsfile`                         |

Because it's one repo, each microservice gets its own **Multibranch Pipeline** job
that points at the *same* Git repository but a *different* Jenkinsfile path
("Script Path"). Jenkins scans branches independently per job, so each service
builds and deploys on its own.

## 1. Prerequisites on the Jenkins controller/agents
- Docker installed on the agent (to build/push images)
- AWS CLI v2 installed and able to assume a role/credentials with:
  - `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`
  - `eks:DescribeCluster` (for `aws eks update-kubeconfig`)
- `kubectl` installed on the agent
- Jenkins plugins: Pipeline, Git, Multibranch Pipeline, Docker Pipeline, (optionally) Amazon ECR / AWS Credentials plugin
- An ECR repository created per service: `dev/student-service`, `dev/teacher-service`, `dev/attendance-service`, `dev/notification-service`, `dev/frontend`
- The EKS namespace created once: `kubectl apply -f k8s/00-namespace.yaml`
- The shared DB secret created once: `kubectl apply -f k8s/01-mysql-secret.yaml` (edit values first, or manage via AWS Secrets Manager / External Secrets Operator instead)

## 2. Create 5 Multibranch Pipeline jobs

For **each** of `student-service`, `teacher-service`, `attendance-service`, `notification-service`, `frontend`:

1. Jenkins → New Item → name it e.g. `student-service-pipeline` → type **Multibranch Pipeline**
2. Branch Sources → Add source → Git (or GitHub) → point at this repo's URL, add credentials
3. Build Configuration → Mode: `by Jenkinsfile`
4. **Script Path**: set to the service's Jenkinsfile, e.g. `services/student-service/Jenkinsfile`
5. Scan Multibranch Pipeline Triggers → enable periodic scan (e.g. every 1 minute) or set up a GitHub webhook for push-triggered scans
6. Save. Jenkins will discover branches (`main`, feature branches, PRs) and run the matching Jenkinsfile on each.

Repeat with Script Path `services/teacher-service/Jenkinsfile`, `services/attendance-service/Jenkinsfile`, `services/notification-service/Jenkinsfile`, and `frontend/Jenkinsfile` for the other four jobs.

## 3. How each pipeline behaves
- **Every branch**: installs deps, builds the Docker image, pushes it to ECR tagged `<branch>-<build-number>`.
- **`main`/`master` only**: additionally runs `kubectl set image` against the matching EKS Deployment, so only your trunk branch auto-deploys. Feature branches just build/push an image for review, but don't touch the cluster.
- Because the 3 Jenkinsfiles live inside their own service folders, each job only cares about its own service's code — you don't need one giant pipeline that rebuilds everything on every commit.

## 4. First-time cluster bootstrap (manual, one-time)
```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-mysql-secret.yaml
kubectl apply -f k8s/02-mysql.yaml          # skip this if you're using RDS instead
kubectl apply -f services/student-service/k8s/deployment.yaml
kubectl apply -f services/teacher-service/k8s/deployment.yaml
kubectl apply -f services/attendance-service/k8s/deployment.yaml
kubectl apply -f services/notification-service/k8s/deployment.yaml
kubectl apply -f frontend/k8s/deployment.yaml
kubectl apply -f k8s/03-ingress.yaml
```
After that, Jenkins takes over image updates via `kubectl set image` on merges to `main`.

## 5. Shared database
All four backend microservices (`student-service`, `teacher-service`,
`attendance-service`, `notification-service`) read the **same** `mysql-secret`
(`host`, `user`, `password`, `database`) — same MySQL instance/database (`school`)
used in `docker-compose.yaml`. Each service only creates/owns its own table
(`student`, `teacher`, `attendance`, or `notification`) at startup, so they can
safely share the DB without stepping on each other's schema.
