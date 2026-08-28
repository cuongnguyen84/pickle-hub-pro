import Foundation
import Testing
@testable import ThePickleHub

@Suite("Shop Phase 4 payment contract")
struct ShopPhase4PaymentContractTests {
    @Test("Payment info decodes manual reconciliation fields")
    func paymentInfoDecoding() throws {
        let json = #"""
        {"found":true,"method":"bank_transfer","amount_vnd":1620000,"memo":"PH-2608-A1B2","claimed_at":"2026-08-18T10:00:00Z","confirmed_at":null,"bank":{"code":"VCB","account_number":"0123456789","account_name":"NGUYEN VAN A"}}
        """#
        let info = try JSONDecoder().decode(ShopOrderPaymentInfo.self, from: Data(json.utf8))
        #expect(info.method == .bankTransfer)
        #expect(info.amountVND == 1_620_000)
        #expect(info.memo == "PH-2608-A1B2")
        #expect(info.claimedAt != nil)
        #expect(info.confirmedAt == nil)
        #expect(info.bank?.accountNumber == "0123456789")
    }

    @Test("VietQR uses exact server memo and integer amount")
    func vietQRContract() throws {
        let url = try #require(VietQR.imageURL(bankCode: "VCB", accountNumber: "0123456789",
                                               accountName: "NGUYEN VAN A", amountVnd: 1_620_000,
                                               memo: "PH-2608-A1B2"))
        let components = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false))
        #expect(components.path == "/image/VCB-0123456789-compact2.png")
        #expect(components.queryItems?.first(where: { $0.name == "amount" })?.value == "1620000")
        #expect(components.queryItems?.first(where: { $0.name == "addInfo" })?.value == "PH-2608-A1B2")
    }

    @Test("Missing bank remains an honest manual-payment state")
    func missingBank() throws {
        let info = try JSONDecoder().decode(
            ShopOrderPaymentInfo.self,
            from: Data(#"{"found":true,"method":"bank_transfer","amount_vnd":100000,"memo":"PH-1","claimed_at":null,"confirmed_at":null,"bank":null}"#.utf8)
        )
        #expect(info.found)
        #expect(info.bank == nil)
        #expect(info.confirmedAt == nil)
    }

    @Test("SePay payment info and signed form decode without secrets")
    func sePayContract() throws {
        let infoJSON = #"{"found":true,"method":"bank_transfer","amount_vnd":125000,"memo":"PH-2608-A1B2","claimed_at":null,"confirmed_at":null,"bank":null,"gateway":{"enabled":true,"provider":"sepay","status":"initiated"}}"#
        let info = try JSONDecoder().decode(ShopOrderPaymentInfo.self, from: Data(infoJSON.utf8))
        #expect(info.gateway?.enabled == true)
        #expect(info.gateway?.provider == "sepay")
        #expect(info.gateway?.status == "initiated")
        #expect(info.bank == nil)

        let checkoutJSON = #"{"checkout_url":"https://pay-sandbox.sepay.vn/v1/checkout/init","fields":{"operation":"PURCHASE","order_amount":"125000","signature":"signed"},"invoice_number":"PH-2608-A1B2","environment":"sandbox"}"#
        let checkout = try JSONDecoder().decode(ShopSePayCheckout.self, from: Data(checkoutJSON.utf8))
        #expect(checkout.checkoutURL == "https://pay-sandbox.sepay.vn/v1/checkout/init")
        #expect(checkout.fields["order_amount"] == "125000")
        #expect(checkout.fields["secret_key"] == nil)
    }
}
