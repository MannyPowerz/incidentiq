/**
 * The Agent Contracts - where the signature, scanner and CLI will be built in parallel
 * 
 *  Scanner (Anthony) - Detect --> collect()
 *  Signature (Anthony) - Evaluate -> evaluate() EnvSnapShot
 * 
 * The two parts don't block eachother because evaluate() takes it's input as an argument, so a fixture is enough
 * 
 * Notice on architecture.MD:
 * It states that collects() runs on each signature; we should be able to follow the flow of scanner collecting -> signature 
 * evaluating. Since collection is I/O, it should happen once per cycle. Splitting it is what makes evaluate() a pure founction
 * towards a single object, which in return makes it testable with fixtures.
 */

export interface PortProbe {
    readonly port: number;

    //a true value is determined if net.createServer().listen(port) outputs EADDRINUSE
    readonly bound: boolean;

    //the validility of this value is determined if by the time the agent probe has timedout, we check if we get any bytes back
    readonly responsive: boolean;

    readonly latencyMs: number | null;
}

//the machine's present output's once it was scanned.The signature reads from this beacuse it is everything that defines tier 1 scan
export interface EnvSnapShot {
    readonly takenAt: number;// using a number with readonly and not a Date type sidesteps the mutability problem allowing no changes in this column
    readonly nodeVersion: string; //node.version
    readonly osArch: string; //`${os.platform()}-${os.arch()}`
    readonly lockFilehash: string | null; //sha256 of package-lock.json, null if absent
    readonly appliedMigrations: string[]; //`readdir(<root>/server/db/migrations)` filtered to `.sql`, sorted
    readonly ports: PortProbe[]; //one per configed port
    readonly tunnelInterface: string[] //names of utun*/tun*/tap*/wg interfaces present
}

//the agent's entire output surface
export interface Detection {
    signatureId: string; //matches Signature.id, e.g. 'VPN_LOOPBACK'
    tier: 1 | 2;
    severity: 'infor' | 'warn' | 'critical';

    title: string; //this ends up server-side as the incident title
    explanation: string; //the card body and the ai response

    //resolveFilePaths must be elegible to the key
    affectedSystem: string;

    //raw facts for the payload
    evidence: Record<string, unknown>
}

//This makes engine.ts a ten-line map-filter over an array and every signature a pure function testable with a fixture
export interface Signature {
    id: string;
    tier: 1 | 2;
    severity: 'infor' | 'warn' | 'critical';

    //two constraints - purity & no I/0. If either is violated
    evaluate(snapshot:EnvSnapShot): Detection | null
}