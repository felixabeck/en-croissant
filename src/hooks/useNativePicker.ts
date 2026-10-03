import { useRef, useState } from "react";

/** Owns one picker activation, including its caller's outcome handling. */
export function useNativePicker() {
    const inFlight = useRef(false);
    const [pending, setPending] = useState(false);
    async function run(action: () => Promise<void>): Promise<void> {
        if (inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        try {
            await action();
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    }
    return { pending, run };
}
