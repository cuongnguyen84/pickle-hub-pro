import Testing
@testable import ThePickleHub

@Suite("PostgREST search grammar")
struct SearchRepositoryTests {
    @Test("Reserved punctuation remains literal inside a quoted filter")
    func punctuationIsPreserved() {
        #expect(SearchRepository.quotedILikePattern("A.B, (C): D") == #""%A.B, (C): D%""#)
    }

    @Test("Quotes and backslashes cannot escape the filter value")
    func quotesAndBackslashesAreEscaped() {
        #expect(SearchRepository.quotedILikePattern(#"a"b\c"#) == #""%a\"b\\c%""#)
    }

    @Test("User wildcards are literals while search boundaries stay wildcards")
    func wildcardsAreEscaped() {
        #expect(SearchRepository.quotedILikePattern("100%_win*") == #""%100\%\_win\*%""#)
    }
}
