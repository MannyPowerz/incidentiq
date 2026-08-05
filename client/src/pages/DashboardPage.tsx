import type { JSX } from "react"
import "./DashboardPage.css"
import DashboardSidebar from "../components/dashboard/DashboardSidebar"
import DashboardHeader from "../components/dashboard/DashboardHeader"
import StatisticsGrid from "../components/dashboard/StatisticsGrid"
import RecentIncidents from "../components/dashboard/RecentIncidents"
import QuickActions from "../components/dashboard/QuickActions"

export default function DashboardPage() : JSX.Element {
    return (
        <div className="dashboard-layout">
            <DashboardSidebar activePage="Dashboard" />
            <main className="dashboard-page">
                <div className="dashboard-container">
                    <DashboardHeader />
                    <StatisticsGrid />
                    <RecentIncidents />
                    <QuickActions />
                </div>
            </main>
        </div>
    )
}
