// jsdom has no ResizeObserver. This one observes nothing: a component that measures itself (a
// Mantine SegmentedControl's floating indicator) renders as if it were never resized.
class InertResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

export function installResizeObserverStub() {
    Object.defineProperty(window, "ResizeObserver", {
        writable: true,
        value: InertResizeObserver,
    });
}
