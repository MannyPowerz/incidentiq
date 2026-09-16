import { useState } from "react";
import type { JSX, ChangeEvent, ComponentProps } from "react";
import type { Room } from "../../../types/room";
import { timelineEvents } from "../../../data/timelineEvents";
import type { TimelineEvent, ManualTimelineEventType } from "../../../types/timelineEvent";
import "./RoomTimeline.css"

type RoomTimelineProps = {
    room: Room
}

export default function RoomTimeline ({ room }: RoomTimelineProps) : JSX.Element {

    const initialEvents = timelineEvents
        .filter((event) => event.roomId === room.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    const [ events, setEvents ] = useState<TimelineEvent[]>(initialEvents)

    const [ entryType, setEntryType ] = useState<ManualTimelineEventType>("observation")

    const [ entryTitle, setEntryTitle ] = useState<string>("")

    const [ entryText, setEntryText ] = useState<string>("")

    const handleSubmit: ComponentProps<"form">["onSubmit"] = event => {
        event.preventDefault()

        const trimmedTitle = entryTitle.trim()
        const trimmedEntry = entryText.trim()

        if (!trimmedEntry || !trimmedTitle) {
            return
        }

        const newEvent: TimelineEvent = {
            id: Date.now(),
            roomId: room.id,
            createdAt: new Date(),
            title: trimmedTitle,
            description: trimmedEntry,
            author: "You",
            type: entryType
        }

        setEvents((currentEvents) => [
            ...currentEvents,
            newEvent,
        ])

        setEntryType("observation")
        setEntryTitle("")
        setEntryText("")
    }

    function handleTypeChange( event: ChangeEvent<HTMLSelectElement> ) : void {
        setEntryType(event.target.value as ManualTimelineEventType)
    }

    return (
        <section 
            className="room-timeline"
            aria-labelledby="room-timeline-title"
        >
            <div className="room-timeline-panel">

                <div className="room-timeline-header">
                    <div>
                        <h2 id="room-timeline-title" className="room-timeline-title">Timeline</h2>
                        <p className="room-timeline-subtitle">Investigation activity for {room.id}</p>
                    </div>
                </div>

                <div className="room-timeline-list">
                    {events.length > 0 ? (
                        events.map((event) => (
                            <article
                                key={event.id}
                                className="room-timeline-event"
                            >
                                <time
                                    className="room-timeline-event-time"
                                    dateTime={event.createdAt.toISOString()}
                                >
                                    <span className="room-timeline-event-date">
                                        {event.createdAt.toLocaleDateString(
                                            "en-US",
                                            {
                                                month: "short",
                                                day: "numeric",
                                            }
                                    )}
                                    </span>

                                    <span className="room-timeline-event-clock">
                                        {event.createdAt.toLocaleTimeString(
                                            "en-US",
                                            {
                                                hour: "numeric",
                                                minute: "2-digit",
                                            }
                                    )}
                                    </span>
                                </time>

                                <div className="room-timeline-marker">
                                    <span 
                                        className={`room-timeline-dot ` + `room-timeline-dot-${event.type}`} 
                                    />
                                </div>

                                <div className="room-timeline-event-content">

                                    <div className="room-timeline-event-heading">
                                        <span
                                            className={`room-timeline-event-type ` + `room-timeline-event-type-${event.type}`}
                                        >
                                            {event.type.replace(
                                                "_", " "
                                            )}
                                        </span>

                                        <h3>{event.title}</h3>
                                    </div>

                                    <p className="room-timeline-event-description">{event.description}</p>
                                    <span className="room-timeline-author">
                                        Posted by {event.author}
                                    </span>

                                </div>
                            </article>
                        ))
                    ) : (

                        <p className="room-timeline-empty">No timeline activity yet</p>

                    )}
                </div>

                <form 
                    className="room-timeline-update-form"
                    onSubmit={handleSubmit}    
                >
                    <div className="room-timeline-form-field">

                        <label 
                            className="room-timeline-update-label"
                            htmlFor="timeline-entry-type"
                        >
                            Entry type
                        </label>

                        <select
                            id="timeline-entry-type"
                            className="room-timeline-update-select"
                            value={entryType}
                            onChange={handleTypeChange}
                        >
                            <option value="observation">Observation</option>
                            <option value="action">Action</option>
                            <option value="finding">Finding</option>
                        </select>
                    </div>

                    <div className="room-timeline-form-field">
                        <label 
                            className="room-timeline-update-label"
                            htmlFor="timeline-entry-title"
                        >
                            Title
                        </label>

                        <input
                            id="timeline-entry-title"
                            className="room-timeline-update-title-input"
                            type="text"
                            placeholder="Example: Database logs reviewed"
                            value={entryTitle}
                            onChange={(event) => setEntryTitle(event.target.value)}
                            required
                        />
                    </div>

                    <div className={"room-timeline-form-field " + "room-timeline-form-field-update"}>
                        <label  
                            className="room-timeline-update-label"
                            htmlFor="timeline-entry"
                        >
                            Details
                        </label>

                        <textarea
                            id="timeline-entry"
                            className="room-timeline-update-input"
                            placeholder="Share what you observed, did, or discovered..."
                            rows={4}
                            value={entryText}
                            onChange={(event) => setEntryText(event.target.value)}
                            required
                        />
                    </div>

                    <button 
                        className="room-timeline-update-button" 
                        type="submit"
                        disabled={!entryTitle.trim() || !entryText.trim()}
                    >
                        Post Entry
                    </button>

                </form>

            </div>
        </section>
    )
}
