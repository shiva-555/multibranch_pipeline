// Routes.js – fixed for React Router v6+
import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import Student from "./Student";
import Teacher from "./Teacher";
import Attendance from "./Attendance";
import Notification from "./Notification";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/student" element={<Student />} />
      <Route path="/teacher" element={<Teacher />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/notification" element={<Notification />} />
    </Routes>
  );
}
