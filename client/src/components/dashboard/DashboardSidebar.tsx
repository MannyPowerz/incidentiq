import type { JSX } from "react"
import { DoorOpen, FileText, LayoutDashboard, Settings, User, Users } from "lucide-react"
import "./DashboardSidebar.css"

type DashboardSidebarProps = {
    activePage? : "Dashboard" | "Rooms" | "Reports" | "Teams" | "Settings"
}

export default function DashboardSidebar ({ activePage = "Dashboard"} : DashboardSidebarProps) : JSX.Element {
    
    const navigationItems = [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
        },
        {
            label: "Rooms",
            icon: DoorOpen,
        },
        {
            label: "Reports",
            icon: FileText,
        },
        {
            label: "Teams",
            icon: Users,
        },
        {
            label: "Settings",
            icon: Settings,
        },
    ] as const

    return (
        <aside className="dashboard-sidebar">
            <div className="dashboard-sidebar-brand">
                <div className="dashboard-sidebar-logo">IQ</div>
                <span className="dashboard-sidebar-brand-name">IncidentIQ</span>
            </div>

            <nav className="dashboard-sidebar-naviagtion">
                {navigationItems.map(({label, icon: Icon}) => (
                    <button
                        type="button"
                        key={label}
                        className={
                            activePage === label
                            ? "dashboard-sidebar-link dashboard-sidebar-link-active"
                            : "dashboard-sidebar-link"
                        }
                    >
                        <Icon size={18} aria-hidden="true" />
                        <span>{label}</span>
                    </button>
                ))}
            </nav>

            <button type="button" className="dashboard-sidebar-collapse">
                Collapse
            </button>
        </aside>
    )
}