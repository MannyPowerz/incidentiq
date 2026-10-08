import type { JSX, ReactNode } from 'react';
import './Table.css';

export type TableColumn<T> = {
    key: string;
    header: string;
    render: (row: T) => ReactNode;
    // keep narrow columns (badges, timestamps) from stretching
    width?: string;
};

type TableProps<T> = {
    columns: TableColumn<T>[];
    rows: T[];
    rowKey: (row: T) => string | number;
    // shown instead of the table when rows is empty, so the empty state is never forgotten
    empty: ReactNode;
    caption?: string;
};

/**
 * Table — one markup, two layouts. Each cell carries its column header in data-label, and below
 * the tablet breakpoint CSS turns rows into stacked cards that print that label beside the value.
 * No row-click handler on purpose: a clickable <tr> is unreachable by keyboard, so a row that
 * navigates should render a real <a> in one of its cells instead.
 */
export default function Table<T>({ columns, rows, rowKey, empty, caption }: TableProps<T>): JSX.Element {
    if (rows.length === 0) return <>{empty}</>;

    return (
        <div className="ui-table-wrap">
            <table className="ui-table">
                {caption && <caption className="ui-sr-only">{caption}</caption>}
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col.key} scope="col" style={col.width ? { width: col.width } : undefined}>
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={rowKey(row)}>
                            {columns.map((col) => (
                                <td key={col.key} data-label={col.header}>
                                    {col.render(row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
