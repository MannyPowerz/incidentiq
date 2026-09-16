import type { AIAnalysis } from "../types/aiAnalysis";

export const aiAnalyses: AIAnalysis [] = [
    {
        roomId: "ROOM-0001",
        summary:
            "The incident appears to be related to repeated authentication failures affecting access to the service.",
        why_it_matters:
            "Users may be unable to access critical functionality, which could interrupt normal operations and increase support volume.",
        likely_fix:
            "Review recent authentication-related changes and inspect the affected service configuration and logs. If a recent configuration change introduced the issue, correct or roll back that change.",
    },
    {
        roomId: "ROOM-0002",
        summary:
            "The incident appears to involve degraded service performance and increased response times.",
        why_it_matters:
            "Slow response times can affect user experience and may indicate resource exhaustion or another underlying service problem.",
        likely_fix:
            "Check service metrics, recent deployments, and resource usage. Identify any abnormal load or recent changes and address the source of the performance degradation.",
    },
    {
        roomId: "ROOM-0003",
        summary:
            "The incident appears to be related to intermittent connectivity between application components.",
        why_it_matters:
            "Intermittent connectivity can cause failed requests and inconsistent application behavior.",
        likely_fix:
            "Review network and service logs for connection failures. Verify service health, configuration, and dependencies to determine where communication is breaking down.",
    },
]