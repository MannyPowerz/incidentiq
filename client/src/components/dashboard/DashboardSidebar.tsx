import type { JSX } from "react"
import { useState } from "react"
import { DoorOpen, FileText, LayoutDashboard, Settings, Users, ChevronLeft, ChevronRight } from "lucide-react"
import "./DashboardSidebar.css"

type DashboardSidebarProps = {
    activePage? : "Dashboard" | "Rooms" | "Reports" | "Teams" | "Settings"
}

export default function DashboardSidebar ({ activePage = "Dashboard"} : DashboardSidebarProps) : JSX.Element {

    const [ isCollapsed, setIsCollapsed ] = useState<boolean>(false)
    
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

    function handleToggleSidebar() : void {
        setIsCollapsed((currentValue) => !currentValue)
    }

    return (
        <aside className={`dashboard-sidebar ${isCollapsed ? "dashboard-sidebar-collapsed" : ""}`} >
            <div className="dashboard-sidebar-brand">

                <div className="dashboard-sidebar-brand-content">
                    <div className="dashboard-sidebar-logo">IQ</div>
                    {!isCollapsed && (
                        <span className="dashboard-sidebar-brand-name">
                            IncidentIQ
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    className="dashboard-sidebar-toggle"
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    onClick={handleToggleSidebar}
                >
                    {isCollapsed ? (
                        <ChevronRight size={18} aria-hidden="true" />
                    ) : (
                        <ChevronLeft size={18} aria-hidden="true" />
                    )}

                </button>
            </div>

            <nav className="dashboard-sidebar-naviagtion">
                {navigationItems.map(({label, icon: Icon}) => (
                    <button
                        type="button"
                        aria-label={isCollapsed ? label : undefined}
                        title={isCollapsed ? label : undefined}
                        key={label}
                        className={
                            activePage === label
                            ? "dashboard-sidebar-link dashboard-sidebar-link-active"
                            : "dashboard-sidebar-link"
                        }
                    >
                        <Icon size={18} aria-hidden="true" />
                        {!isCollapsed && <span>{label}</span>}
                    </button>
                ))}
            </nav>
        </aside>
    )
}