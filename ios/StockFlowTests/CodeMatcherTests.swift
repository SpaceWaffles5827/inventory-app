import Testing
@testable import StockFlow

struct CodeMatcherTests {
    private struct Thing { let barcode: String?; let code: String }

    private let things = [
        Thing(barcode: "0885909950805", code: "ITM-001"),
        Thing(barcode: "LOC-A-01-01", code: "A-01-01"),
        Thing(barcode: nil, code: "ITM-010"),
    ]

    private func find(_ code: String) -> Thing? {
        CodeMatcher.find(in: things, code: code, barcode: \.barcode, fallback: \.code)
    }

    @Test func matchesBarcodeExactly() {
        #expect(find("0885909950805")?.code == "ITM-001")
    }

    @Test func numericCodesIgnoreLeadingZeros() {
        // UPC-A scanned as EAN-13 (leading 0) and GTIN-14 (two leading zeros).
        #expect(find("885909950805")?.code == "ITM-001")
        #expect(find("00885909950805")?.code == "ITM-001")
    }

    @Test func isCaseInsensitiveAndTrimmed() {
        #expect(find("  loc-a-01-01 ")?.code == "A-01-01")
        #expect(find("itm-010")?.code == "ITM-010")
    }

    @Test func fallsBackToItemNumber() {
        #expect(find("ITM-001")?.code == "ITM-001")
    }

    @Test func unknownAndEmptyCodesDontMatch() {
        #expect(find("999") == nil)
        #expect(find("") == nil)
        #expect(find("   ") == nil)
    }

    @Test func numericCore() {
        #expect(CodeMatcher.numericCore("000123") == "123")
        #expect(CodeMatcher.numericCore("0000") == "0")
        #expect(CodeMatcher.numericCore("12a") == nil)
        #expect(CodeMatcher.numericCore("") == nil)
    }
}
