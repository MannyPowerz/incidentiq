import { useState } from "react";
import type { JSX, ChangeEvent, ComponentProps } from "react";
import type { Room } from "../../../types/room";
import { timelineEvents } from "../../../data/timelineEvents";
import "./RoomTimeline.css"
import type { TimelineEvent, ManualTimelineEventTypes } from "../../../types/timelineEvent";

type RoomTimelineProps = {
    room: Room
}

export default function RoomTimeline ({ room }: RoomTimelineProps) : JSX.Element {

    const initialEvents = timelineEvents
        .filter((event) => event.roomId === room.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    const [ events, setEvents ] = useState<TimelineEvent[]>(initialEvents)

    const [ updateType, setUpdateType ] = useState<ManualTimelineEventTypes>("update")

    const [ updateTitle, setUpdateTitle ] = useState<string>("")

    const [ updateText, setUpdateText ] = useState<string>("")

    const handleSubmit: ComponentProps<"form">["onSubmit"] = event => {
        event.preventDefault()

        const trimmedTitle = updateTitle.trim()
        const trimmedUpdate = updateText.trim()

        if (!trimmedUpdate || !trimmedTitle) {
            return
        }

        const newEvent: TimelineEvent = {
            id: Date.now(),
            roomId: room.id,
            createdAt: new Date(),
            title: trimmedTitle,
            description: trimmedUpdate,
            author: "You",
            type: updateType
        }

        setEvents((currentEvents) => [
            ...currentEvents,
            newEvent,
        ])

        setUpdateType("update")
        setUpdateTitle("")
        setUpdateText("")
    }

    function handleTypeChange( event: ChangeEvent<HTMLSelectElement> ) : void {
        setUpdateType(event.target.value as ManualTimelineEventTypes)
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
                        <p className="room-timeline-subtitle">Activity and updates for {room.id}</p>
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
                                    <h3>{event.title}</h3>

                                    <p className="room-timeline-event-description">{event.description}</p>

                                    <span className="room-timeline-author">Posted by {event.author}</span>
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
                            htmlFor="timeline-update-type"
                        >
                            Type
                        </label>

                        <select
                            id="timeline-update-type"
                            className="room-timeline-update-select"
                            value={updateType}
                            onChange={handleTypeChange}
                        >
                            <option value="update">Investigation Update</option>
                            <option value="detection">Detection</option>
                            <option value="evidence">Evidence</option>
                        </select>
                    </div>

                    <div className="room-timeline-form-field">
                        <label 
                            className="room-timeline-update-label"
                            htmlFor="timeline-update-title"
                        >
                            Title
                        </label>

                        <input
                            id="timeline-update-title"
                            className="room-timeline-update-title-input"
                            type="text"
                            placeholder="Example: Database logs reviewed"
                            value={updateTitle}
                            onChange={(event) => setUpdateTitle(event.target.value)}
                            required
                        />
                    </div>

                    <div className="room-timeline-form-field room-timeline-form-field-update">
                        <label  
                            className="room-timeline-update-label"
                            htmlFor="timeline-update"
                        >
                            Update
                        </label>

                        <textarea
                            id="timeline-update"
                            className="room-timeline-update-input"
                            placeholder="Share an update with the team..."
                            rows={4}
                            value={updateText}
                            onChange={(event) => setUpdateText(event.target.value)}
                            required
                        />
                    </div>

                    <button 
                        className="room-timeline-update-button" 
                        type="submit"
                        disabled={!updateTitle.trim() || !updateText.trim()}
                    >
                        Post Update
                    </button>

                </form>

            </div>
        </section>
    )
}
