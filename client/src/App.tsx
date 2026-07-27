import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom"
import SignInPage from "./pages/SignInPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() : JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signin" replace />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}