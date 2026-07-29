import type { JSX } from "react"
import "./DashboardHeader.css"

export default function DashboardHeader () : JSX.Element {
    return (
        <header className="dashboard-header">
            <div>
                <p className="dashboard-greeting">Hello John</p>
                <h1>Incident Management Dashboard</h1>
                <p className="dashboard-subtitle">
                    Monitor and respond to active incidents
                </p>
            </div>

            <div className="dashboard-header-actions">
                <button className="icon-button">🔔</button>
                <button className="icon-button">👤</button>
            </div>
        </header>
    )
}