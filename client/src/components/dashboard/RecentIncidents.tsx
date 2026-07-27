import "./RecentIncidents.css"

// Temp data just for building purposes
const incidents =[
    {
        id: 1,
        title: "Critical test",
        status: "Critical",
        owner: "Backend Team",
        updated: "5 min. ago"
    },
    {
    id: 2,
    title: "Invetigating test",
    status: "Investigating",
    owner: "Platform Team",
    updated: "18 min. ago",
  },
  {
    id: 3,
    title: "Open test",
    status: "Open",
    owner: "Messaging Team",
    updated: "42 min. ago",
  },
]

export default function RecentIncidents() {
    return (
        <section className="recent-incidents">
            <div className="recent-incidents-header">
                <div>
                    <h2>Recent Incidents Rooms</h2>
                    <p>Review the latest active incidents and their status</p>
                </div>

                <button type="button" className="view-all-button">
                    View all
                </button>
            </div>

            <div className="incident-list">
                {incidents.map((incident) => (
                    <article className="incident-item" key={incident.id}>
                        <div className="incident-main">
                            <h3>{incident.title}</h3>
                            <p>{incident.owner}</p>
                        </div>

                        <span className={`incident-status incident-status-${incident.status.toLowerCase()}`}>
                            {incident.status}
                        </span>

                        <p className="incident-updated">
                            {incident.updated}
                        </p>
                    </article>
                ))}
            </div>
        </section>
    )
}