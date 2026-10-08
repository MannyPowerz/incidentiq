// takes the API's ISO string directly; under a minute reads "just now" rather than "0 minutes ago"
export function formatRelativeTime(value: Date | string, now: number = Date.now()): string {
    const date = typeof value === "string" ? new Date(value) : value
    const minutes = Math.floor((now - date.getTime()) / 60000)

    if (minutes < 1) {
        return "just now"
    }

    if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
    }

    const hours = Math.floor(minutes / 60)

    if (hours < 24) {
        return `${hours} hour${hours === 1 ? "" : "s"} ago`
    }

    const days = Math.floor(hours / 24)

    return `${days} day${days === 1 ? "" : "s"} ago`
}
