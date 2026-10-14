import type { JSX, ReactNode } from 'react';
import './Metric.css';

type MetricProps = {
    label: string;
    // the number or value itself — the one place the UI uses pure white
    value: ReactNode;
    // a unit, delta, or short note under the value
    detail?: string;
    tone?: 'neutral' | 'danger' | 'warning' | 'success';
};

/**
 * Metric — a stat tile. Label in the muted tone, value in --color-data (white, mono), so the
 * number is the brightest thing on the screen and the label never competes with it.
 */
export default function Metric({ label, value, detail, tone = 'neutral' }: MetricProps): JSX.Element {
    return (
        <div className={`ui-metric ui-metric--${tone}`}>
            <span className="ui-metric__label">{label}</span>
            <span className="ui-metric__value">{value}</span>
            {detail && <span className="ui-metric__detail">{detail}</span>}
        </div>
    );
}
