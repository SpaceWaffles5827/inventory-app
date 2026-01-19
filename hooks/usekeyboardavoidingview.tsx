import { useState, useEffect, useRef, RefObject } from 'react'

interface UseKeyboardAvoidingViewOptions {
    /** Enable keyboard detection (default: true on mobile) */
    enabled?: boolean
    /** Minimum height difference to consider keyboard visible (default: 150) */
    keyboardThreshold?: number
    /** Delay before scrolling to focused input in ms (default: 100) */
    scrollDelay?: number
    /** Scroll behavior (default: 'smooth') */
    scrollBehavior?: ScrollBehavior
    /** Offset from top when scrolling to input (default: 1/3 of visible height) */
    scrollOffset?: number | 'auto'
}

interface KeyboardAvoidingViewReturn {
    /** Current keyboard height in pixels */
    keyboardHeight: number
    /** Whether keyboard is currently visible */
    isKeyboardVisible: boolean
    /** Whether running on mobile device */
    isMobile: boolean
    /** Ref to attach to scrollable container */
    scrollContainerRef: RefObject<HTMLDivElement>
    /** Style object for container with keyboard adjustments */
    containerStyle: React.CSSProperties
    /** Style object for scrollable content */
    scrollableStyle: React.CSSProperties
    /** Style object for fixed footer */
    footerStyle: React.CSSProperties
}

/**
 * A React hook that provides keyboard-aware scrolling behavior similar to React Native's KeyboardAvoidingView.
 * Automatically detects mobile keyboards and adjusts scroll position to keep focused inputs visible.
 * 
 * @example
 * ```tsx
 * function MyDialog() {
 *   const { 
 *     scrollContainerRef, 
 *     containerStyle, 
 *     scrollableStyle,
 *     footerStyle,
 *     isKeyboardVisible 
 *   } = useKeyboardAvoidingView()
 * 
 *   return (
 *     <div style={containerStyle}>
 *       <div ref={scrollContainerRef} style={scrollableStyle}>
 *         <input type="text" />
 *       </div>
 *       <div style={footerStyle}>
 *         <button>Submit</button>
 *       </div>
 *     </div>
 *   )
 * }
 * ```
 */
export function useKeyboardAvoidingView(
    options: UseKeyboardAvoidingViewOptions = {}
): KeyboardAvoidingViewReturn {
    const {
        enabled,
        keyboardThreshold = 150,
        scrollDelay = 100,
        scrollBehavior = 'smooth',
        scrollOffset = 'auto',
    } = options

    const [keyboardHeight, setKeyboardHeight] = useState(0)
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const activeInputRef = useRef<HTMLElement | null>(null)
    const initialViewportHeightRef = useRef<number>(0)

    // Detect if running on mobile device
    useEffect(() => {
        const checkMobile = () => {
            const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
            setIsMobile(isMobileDevice)
            return isMobileDevice
        }

        checkMobile()
        // Re-check on resize in case of orientation change
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Track active input element
    useEffect(() => {
        if (!isMobile || enabled === false) return

        const handleFocus = (e: FocusEvent) => {
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                activeInputRef.current = target
            }
        }

        const handleBlur = () => {
            // Small delay before clearing to allow for input switching
            setTimeout(() => {
                const activeElement = document.activeElement
                if (activeElement?.tagName !== 'INPUT' &&
                    activeElement?.tagName !== 'TEXTAREA') {
                    activeInputRef.current = null
                }
            }, 100)
        }

        document.addEventListener('focusin', handleFocus, true)
        document.addEventListener('focusout', handleBlur, true)

        return () => {
            document.removeEventListener('focusin', handleFocus, true)
            document.removeEventListener('focusout', handleBlur, true)
        }
    }, [isMobile, enabled])

    // Handle keyboard appearance/disappearance
    useEffect(() => {
        if (!isMobile || enabled === false) return

        // Store initial viewport height
        initialViewportHeightRef.current = window.visualViewport?.height || window.innerHeight

        const handleViewportResize = () => {
            const currentHeight = window.visualViewport?.height || window.innerHeight
            const initialHeight = initialViewportHeightRef.current
            const heightDifference = initialHeight - currentHeight

            // Keyboard is visible if viewport shrunk by more than threshold
            if (heightDifference > keyboardThreshold) {
                setIsKeyboardVisible(true)
                setKeyboardHeight(heightDifference)

                // Scroll active input into view after a brief delay
                setTimeout(() => {
                    scrollToActiveInput(currentHeight)
                }, scrollDelay)
            } else {
                setIsKeyboardVisible(false)
                setKeyboardHeight(0)
            }
        }

        const scrollToActiveInput = (visibleHeight: number) => {
            if (!activeInputRef.current || !scrollContainerRef.current) return

            const inputRect = activeInputRef.current.getBoundingClientRect()
            const containerRect = scrollContainerRef.current.getBoundingClientRect()
            const scrollTop = scrollContainerRef.current.scrollTop

            // Calculate position to scroll to
            let targetOffset: number
            if (scrollOffset === 'auto') {
                // Center in top third of visible area
                targetOffset = visibleHeight / 3
            } else {
                targetOffset = scrollOffset
            }

            const targetScroll = scrollTop + inputRect.top - containerRect.top - targetOffset

            scrollContainerRef.current.scrollTo({
                top: Math.max(0, targetScroll),
                behavior: scrollBehavior
            })
        }

        // Listen for viewport changes
        window.visualViewport?.addEventListener('resize', handleViewportResize)
        window.addEventListener('resize', handleViewportResize)

        return () => {
            window.visualViewport?.removeEventListener('resize', handleViewportResize)
            window.removeEventListener('resize', handleViewportResize)
        }
    }, [isMobile, enabled, keyboardThreshold, scrollDelay, scrollBehavior, scrollOffset])

    // Calculate styles
    const containerStyle: React.CSSProperties = isMobile && isKeyboardVisible ? {
        maxHeight: `${window.visualViewport?.height || window.innerHeight}px`,
        height: `${window.visualViewport?.height || window.innerHeight}px`,
    } : {
        maxHeight: '90vh',
        height: 'auto',
    }

    const scrollableStyle: React.CSSProperties = {
        WebkitOverflowScrolling: 'touch' as any,
        paddingBottom: isMobile && isKeyboardVisible ? '20px' : '0px',
    }

    const footerStyle: React.CSSProperties = isMobile && isKeyboardVisible ? {
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
    } : {
        position: 'relative',
    }

    return {
        keyboardHeight,
        isKeyboardVisible,
        isMobile,
        scrollContainerRef,
        containerStyle,
        scrollableStyle,
        footerStyle,
    }
}