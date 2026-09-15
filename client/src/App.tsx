import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom"
import RequireAuth from "./auth/RequireAuth";
import SignInPage from "./pages/SignInPage";
import DashboardPage from "./pages/DashboardPage";
import RoomsPage from "./pages/RoomsPage";
import RoomDetailsPage from "./pages/RoomDetailsPage";

export default function App() : JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signin" replace />} />
      {/* TODO: decision — /signin stays reachable while signed in. Redirecting to /rooms is a one-line
          guard in reverse; not in the done-criteria, so left for the redesign. */}
      <Route path="/signin" element={<SignInPage />} />

      {/* Every page below needs a session. Wrapped per-route rather than a nested layout route: the
          Routes tree is flat today, and the wrapper is the same either way. */}
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/rooms" element={<RequireAuth><RoomsPage /></RequireAuth>} />
      <Route path="/rooms/:roomId" element={<RequireAuth><RoomDetailsPage /></RequireAuth>} />
    </Routes>
  );
}
