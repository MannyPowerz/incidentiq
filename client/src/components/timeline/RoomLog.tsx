import { useLayoutEffect, useRef } from 'react';
import type { JSX } from 'react';
import type { LogLine } from '../../hooks/useRoomLog';
import './RoomLog.css';

// how close to the bottom still counts as "following the stream"
const STICK_THRESHOLD_PX = 24;

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/**
 * RoomLog — the activity stream as a terminal-style panel. Follows new lines while you are at the
 * bottom, and stops following the moment you scroll up to read, so a busy room never yanks the view.
 * aria-live is off: arrivals are already announced once by the page's polite region, and a log
 * that also spoke would say everything twice.
 */
export default function RoomLog({ lines }: { lines: LogLine[] }): JSX.Element {
    const listRef = useRef<HTMLOListElement>(null);
    const following = useRef(true);

    useLayoutEffect(() => {
        const list = listRef.current;
        if (list && following.current) list.scrollTop = list.scrollHeight;
    }, [lines]);

    return (
        <section className="room-log" aria-labelledby="room-log-heading">
            <header className="room-log__header">
                <h2 id="room-log-heading" className="room-log__title">
                    Activity log
                </h2>
                <span className="room-log__count">{lines.length === 0 ? 'waiting' : `${lines.length} events`}</span>
            </header>
            <ol
                ref={listRef}
                className="room-log__lines"
                role="log"
                aria-live="off"
                aria-label="Room activity"
                tabIndex={0}
                onScroll={(e) => {
                    const el = e.currentTarget;
                    following.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD_PX;
                }}
            >
                {lines.length === 0 && <li className="room-log__empty">Waiting for activity. Connecting, posts and AI drafts show up here as they happen.</li>}
                {lines.map((line) => (
                    <li key={line.id} className={`room-log__line room-log__line--${line.level}`}>
                        <time className="room-log__time" dateTime={line.at}>
                            {time(line.at)}
                        </time>
                        <span className={`room-log__source room-log__source--${line.source}`}>{line.source}</span>
                        <span className="room-log__message">{line.message}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}
