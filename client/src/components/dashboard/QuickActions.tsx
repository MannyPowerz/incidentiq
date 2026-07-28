import type { JSX } from "react"
import "./QuickActions.css"

export default function QuickActions() : JSX.Element {
    return (
        <section className="quick-actions">
            <div className="quick-actions-header">
                <h2>Quick Actions</h2>
                <p>Start incident management tasks</p>
            </div>

            <div className="quick-actions-grid">
                <button type="button" className="quick-action-button">
                    <span className="quick-action-icon">+</span>
                    <span>
                        <strong>Create Incident Room</strong>
                        <small>Open a new room</small>
                    </span>
                </button>

                <button type="button" className="quick-action-button">
                    <span className="quick-action-icon">O</span>
                    <span>
                        <strong>Investigate Incident</strong>
                        <small>Review active issues and assign them</small>
                    </span>
                </button>

                <button type="button" className="quick-action-button">
                    <span className="quick-action-icon">✔</span>
                    <span>
                        <strong>Resolved Rooms</strong>
                        <small>View recently solved incidents</small>
                    </span>
                </button>
            </div>
        </section>
    )
}