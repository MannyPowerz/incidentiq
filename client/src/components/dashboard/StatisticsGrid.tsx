import type { JSX } from "react";
import StatisticsCard from "./StatisticsCard";

export default function StatisticsGrid(): JSX.Element {
    return (
        <section className="statistics-grid">
            <StatisticsCard title="Open Rooms" value="24" />
            <StatisticsCard title="Critical Rooms" value="3" />
            <StatisticsCard title="Investigating Rooms" value="8" />
            <StatisticsCard title="Resolved Rooms" value="19" />
         </section>
    )
}