import type { JSX } from "react"
import "./StatisticsCard.css"

type StatisticsCardProps = {
    title: string;
    value: string | number;
}

export default function StatisticsCard ({title, value} : StatisticsCardProps): JSX.Element {
    return (
        <article className="statistics-card">
            <h3 className="statistics-card-title">{title}</h3>
            <p className="statistics-card-value">{value}</p>
        </article>
    )
}