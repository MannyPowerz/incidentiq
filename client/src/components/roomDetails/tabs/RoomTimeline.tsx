import { useState } from "react";
import type { JSX, FormEvent } from "react";
import type { Room } from "../../../types/room";
import { timelineEvents } from "../../../data/timelineEvents";
import { formatDateTime } from "../../../utils/formatDateTime";
import "./RoomTimeline.css"
import type { TimelineEvent } from "../../../types/timelineEvent";

type RoomTimelineProps = {
    room: Room
}

export default function RoomTimeline ({ room }: RoomTimelineProps) : JSX.Element {

    const initialEvents = timelineEvents
        .filter((event) => event.roomId === room.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    const [ events, setEvents ] = useState<TimelineEvent[]>(initialEvents)

    const [ updateTitle, setUpdateTitle ] = useState<string>("")

    const [ updateText, setUpdateText ] = useState<string>("")

    function handleSubmit(event: FormEvent<HTMLFormElement>) : void {
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
            author: "You"
        }

        setEvents((currentEvents) => [
            ...currentEvents,
            newEvent,
        ])

        setUpdateTitle("")
        setUpdateText("")
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

                                <div className="room-timeline-marker">
                                    <span className="room-timeline-dot" />
                                </div>

                                <div className="room-timeline-event-content">

                                    <div className="room-timeline-event-heading">
                                        <h3>{event.title}</h3>
                                        <time dateTime={event.createdAt.toISOString()}>
                                            {formatDateTime(event.createdAt)}
                                        </time>
                                    </div>

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
                    <label 
                        className="room-timeline-update-label"
                        htmlFor="timeline-update-title"
                    >
                        Update title
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
