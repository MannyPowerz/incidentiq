/** 
 * Two files  with two different transports unconditionally INSERT an entry with two different forms of a user id 
 * meaning, they have to undergo through this guard. This function applies a  
 * copied rule that makes sure to extract every user from each transport and figures out who is making that request.
 */

export function resolveAuthorId(kind: string, userId:number): null | number {
    return kind === 'ai_draft' ? null : userId
}