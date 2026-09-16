import type { JSX } from "react";
import type { AIAnalysis } from "../../../types/aiAnalysis";
import "./RoomAIAnalysis.css"

type RoomAIAnalysisProps = {
    analysis: AIAnalysis
}

export default function RoomAIAnalysis({ analysis }: RoomAIAnalysisProps) : JSX.Element {
    return (
        <section className="room-ai-analysis">

            <div className="room-ai-analysis-header">
                <h2>AI Analysis</h2>
                <p>
                    AI-generated analysis based on the available incident information
                </p>
            </div>

            <div className="room-ai-analysis-content">

                <article className="ai-analysis-card">
                    <h3>Summary</h3>
                    <p>{analysis.summary}</p>
                </article>

                <article className="ai-analysis-card">
                    <h3>Why It Matters</h3>
                    <p>{analysis.why_it_matters}</p>
                </article>

                <article className="ai-analysis-card">
                    <h3>Likely Fix</h3>
                    <p>{analysis.likely_fix}</p>
                </article>

            </div>
        </section>
    )
}