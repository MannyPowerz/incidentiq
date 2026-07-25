import "./DashboardPage.css"
import DashboardHeader from "../components/dashboard/DashboardHeader"
import StatisticsGrid from "../components/dashboard/StatisticsGrid"
import RecentIncidents from "../components/dashboard/RecentIncidents"
import QuickActions from "../components/dashboard/QuickActions"

export default function DashboardPage() {
    return (
        <main className="dashboard-page">
            <div className="dashboard-container">
                <DashboardHeader />
                <StatisticsGrid />
                <RecentIncidents />
                <QuickActions />
            </div>
        </main>
    )
}
