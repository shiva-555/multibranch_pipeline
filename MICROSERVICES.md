# Microservices Architecture (added)

The original single Express `backend/` (moved to `backend-legacy/` for reference)
has been split into four independent microservices that share the same MySQL
database:

```
services/
  student-service/       -> owns the `student` table, port 3501
                             GET  /student
                             POST /addstudent
                             DEL  /student/:id
                             GET  /health, /health/db

  teacher-service/        -> owns the `teacher` table, port 3502
                             GET  /teacher
                             POST /addteacher
                             DEL  /teacher/:id
                             GET  /health, /health/db

  attendance-service/     -> owns the `attendance` table, port 3503
                             GET  /attendance  (optional ?date= & ?class= filters)
                             POST /addattendance
                             DEL  /attendance/:id
                             GET  /health, /health/db

  notification-service/   -> owns the `notification` table, port 3504
                             GET  /notification
                             POST /addnotification
                             DEL  /notification/:id
                             GET  /health, /health/db
```

All four services connect to the **same MySQL instance/database** (`school`)
using the same connection pattern as the original monolith — nothing changed
about the database itself, credentials, or schema. Each service only
ensures/owns the one table it needs, so they can safely coexist on the shared
DB without stepping on each other.

The React frontend calls relative `/api/...` paths for everything — only
`frontend/nginx.conf` changed, to route:
- `/api/student*`, `/api/addstudent` → `student-service`
- `/api/teacher*`, `/api/addteacher` → `teacher-service`
- `/api/attendance*`, `/api/addattendance` → `attendance-service`
- `/api/notification*`, `/api/addnotification` → `notification-service`

New frontend pages: `Attendance.js` and `Notification.js` (added to
`Routes.js`, `Navbar.jsx`, and `Home.js`), styled to match the existing
Student/Teacher pages (Chakra UI).

## Local development
```bash
docker compose up --build
```
This now builds/runs: `db`, `student-service`, `teacher-service`,
`attendance-service`, `notification-service`, `frontend`.

## EKS deployment
See `k8s/` for cluster-wide manifests (namespace, shared DB secret, optional
in-cluster MySQL, ALB ingress) and each service's own `k8s/deployment.yaml`
for its Deployment + Service. See `jenkins/README.md` for how to wire up a
Multibranch Pipeline job per microservice (each with its own `Jenkinsfile`,
5 jobs total) so they build/deploy independently.
