import "./StatisticsCard.css"

export default function StatisticsCard ({title, value}) {
    return (
        <article className="statistics-card">
            <h3 className="statistics-card-title">{title}</h3>
            <p className="statistics-card-value">{value}</p>
        </article>
    )
}