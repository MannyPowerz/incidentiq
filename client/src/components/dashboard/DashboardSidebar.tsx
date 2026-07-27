import "./DashboardSidebar.css"

export default function DashboardSidebar () {
    return (
        <aside className="dashboard-sidebar">
            <div className="sidebar-brand">
                <span className="sidebar-logo">IQ</span>
                <span className="sidebar-brand-name">IncidentIQ</span>
            </div>

            <nav className="sidebar-navigation" aria-label="Dashboard navigation">
                <button type="button" className="sidebar-link sidebar-link-active">
                    <span>O</span>
                    Dashboard
                </button>

                <button type="button" className="sidebar-link">
                    <span>O</span>
                    Rooms
                </button>

                <button type="button" className="sidebar-link">
                    <span>O</span>
                    Reports
                </button>

                <button type="button" className="sidebar-link">
                    <span>O</span>
                    Teams
                </button>

                <button type="button" className="sidebar-link">
                    <span>O</span>
                    Settings
                </button>
            </nav>

            <button type="button" className="sidebar-collapse">
                    <span>O</span>
                    Collapse
            </button>
        </aside>
    )
}