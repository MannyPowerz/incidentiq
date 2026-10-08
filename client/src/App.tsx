import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom"
import RequireAuth from "./auth/RequireAuth";
import AppShell from "./components/layout/AppShell";
import SignInPage from "./pages/SignInPage";
import RoomsPage from "./pages/RoomsPage";
import RoomDetailsPage from "./pages/RoomDetailsPage";

export default function App() : JSX.Element {
  return (
    <Routes>
      {/* the guard decides: a live session lands on rooms, anyone else is sent to sign-in */}
      <Route path="/" element={<Navigate to="/rooms" replace />} />
      {/* TODO: decision — /signin stays reachable while signed in. Redirecting to /rooms is a one-line
          guard in reverse; not in the done-criteria, so left for later. */}
      <Route path="/signin" element={<SignInPage />} />

      {/* One guard and one shell for every signed-in page, as a layout route: the pages render
          content only, and adding a page is one line here. */}
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/rooms/:roomId" element={<RoomDetailsPage />} />
      </Route>

      {/* the dashboard was cut from Minimum (schedule.md); an old link or bookmark lands somewhere real */}
      <Route path="/dashboard" element={<Navigate to="/rooms" replace />} />
    </Routes>
  );
}
