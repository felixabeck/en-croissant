import { useMediaQuery } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { fontSizeAtom } from "@/state/atoms";
import { scaleBreakpoint } from "@/styles/theme";

export function useScaledMaxWidth(widthEm: number): boolean {
    const fontSize = useAtomValue(fontSizeAtom);
    return useMediaQuery(`(max-width: ${scaleBreakpoint(widthEm, fontSize)})`);
}
