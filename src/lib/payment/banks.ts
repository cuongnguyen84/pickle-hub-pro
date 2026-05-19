// ============================================================================
// payment / banks — VN bank list used by the VietQR integration
// ----------------------------------------------------------------------------
// Hardcoded subset of banks supported by VietQR.io. The `code` is the
// short identifier VietQR expects in the QR URL path; `shortName` is the
// label shown to the user; `name` is the full legal name. Logos are
// served from img.vietqr.io's CDN.
//
// Not exhaustive — covers the major VN retail banks (>95% of users).
// Add new entries here as they come up; VietQR's full list:
// https://api.vietqr.io/v2/banks
// ============================================================================

export interface BankEntry {
  code: string;
  name: string;
  shortName: string;
  bin: string;
  logo: string;
}

export const VN_BANKS: ReadonlyArray<BankEntry> = [
  { code: "VCB",  shortName: "Vietcombank",  name: "Ngân hàng TMCP Ngoại Thương Việt Nam",            bin: "970436", logo: "https://api.vietqr.io/img/VCB.png" },
  { code: "TCB",  shortName: "Techcombank",  name: "Ngân hàng TMCP Kỹ Thương Việt Nam",                bin: "970407", logo: "https://api.vietqr.io/img/TCB.png" },
  { code: "MB",   shortName: "MB Bank",      name: "Ngân hàng TMCP Quân Đội",                          bin: "970422", logo: "https://api.vietqr.io/img/MB.png" },
  { code: "VPB",  shortName: "VPBank",       name: "Ngân hàng TMCP Việt Nam Thịnh Vượng",              bin: "970432", logo: "https://api.vietqr.io/img/VPB.png" },
  { code: "ACB",  shortName: "ACB",          name: "Ngân hàng TMCP Á Châu",                            bin: "970416", logo: "https://api.vietqr.io/img/ACB.png" },
  { code: "BIDV", shortName: "BIDV",         name: "Ngân hàng TMCP Đầu Tư và Phát Triển Việt Nam",      bin: "970418", logo: "https://api.vietqr.io/img/BIDV.png" },
  { code: "CTG",  shortName: "VietinBank",   name: "Ngân hàng TMCP Công Thương Việt Nam",              bin: "970415", logo: "https://api.vietqr.io/img/CTG.png" },
  { code: "AGRIBANK", shortName: "Agribank", name: "Ngân hàng NN&PTNT Việt Nam",                        bin: "970405", logo: "https://api.vietqr.io/img/VBA.png" },
  { code: "SCB",  shortName: "Sacombank",    name: "Ngân hàng TMCP Sài Gòn Thương Tín",                bin: "970403", logo: "https://api.vietqr.io/img/STB.png" },
  { code: "STB",  shortName: "Sacombank",    name: "Ngân hàng TMCP Sài Gòn Thương Tín",                bin: "970403", logo: "https://api.vietqr.io/img/STB.png" },
  { code: "TPB",  shortName: "TPBank",       name: "Ngân hàng TMCP Tiên Phong",                        bin: "970423", logo: "https://api.vietqr.io/img/TPB.png" },
  { code: "VIB",  shortName: "VIB",          name: "Ngân hàng TMCP Quốc tế Việt Nam",                   bin: "970441", logo: "https://api.vietqr.io/img/VIB.png" },
  { code: "SHB",  shortName: "SHB",          name: "Ngân hàng TMCP Sài Gòn - Hà Nội",                   bin: "970443", logo: "https://api.vietqr.io/img/SHB.png" },
  { code: "MSB",  shortName: "MSB",          name: "Ngân hàng TMCP Hàng Hải",                          bin: "970426", logo: "https://api.vietqr.io/img/MSB.png" },
  { code: "OCB",  shortName: "OCB",          name: "Ngân hàng TMCP Phương Đông",                        bin: "970448", logo: "https://api.vietqr.io/img/OCB.png" },
  { code: "EIB",  shortName: "Eximbank",     name: "Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam",            bin: "970431", logo: "https://api.vietqr.io/img/EIB.png" },
  { code: "HDB",  shortName: "HDBank",       name: "Ngân hàng TMCP Phát Triển TP.HCM",                  bin: "970437", logo: "https://api.vietqr.io/img/HDB.png" },
  { code: "LPB",  shortName: "LPBank",       name: "Ngân hàng TMCP Bưu Điện Liên Việt",                 bin: "970449", logo: "https://api.vietqr.io/img/LPB.png" },
  { code: "ABB",  shortName: "ABBANK",       name: "Ngân hàng TMCP An Bình",                            bin: "970425", logo: "https://api.vietqr.io/img/ABB.png" },
  { code: "VAB",  shortName: "VietABank",    name: "Ngân hàng TMCP Việt Á",                            bin: "970427", logo: "https://api.vietqr.io/img/VAB.png" },
  { code: "NAB",  shortName: "Nam A Bank",   name: "Ngân hàng TMCP Nam Á",                              bin: "970428", logo: "https://api.vietqr.io/img/NAB.png" },
  { code: "PGB",  shortName: "PG Bank",      name: "Ngân hàng TMCP Xăng Dầu Petrolimex",                bin: "970430", logo: "https://api.vietqr.io/img/PGB.png" },
  { code: "BAB",  shortName: "Bac A Bank",   name: "Ngân hàng TMCP Bắc Á",                              bin: "970409", logo: "https://api.vietqr.io/img/BAB.png" },
  { code: "BVB",  shortName: "BaoVietBank",  name: "Ngân hàng TMCP Bảo Việt",                           bin: "970438", logo: "https://api.vietqr.io/img/BVB.png" },
  { code: "VCCB", shortName: "VietCapital",  name: "Ngân hàng TMCP Bản Việt",                           bin: "970454", logo: "https://api.vietqr.io/img/VCCB.png" },
  { code: "SEAB", shortName: "SeABank",      name: "Ngân hàng TMCP Đông Nam Á",                         bin: "970440", logo: "https://api.vietqr.io/img/SEAB.png" },
  { code: "SGICB", shortName: "SAIGONBANK",  name: "Ngân hàng TMCP Sài Gòn Công Thương",                bin: "970400", logo: "https://api.vietqr.io/img/SGICB.png" },
  { code: "DOB",  shortName: "DongA Bank",   name: "Ngân hàng TMCP Đông Á",                            bin: "970406", logo: "https://api.vietqr.io/img/DOB.png" },
  { code: "GPB",  shortName: "GPBank",       name: "Ngân hàng Dầu Khí Toàn Cầu",                       bin: "970408", logo: "https://api.vietqr.io/img/GPB.png" },
  { code: "OCEAN", shortName: "OceanBank",   name: "Ngân hàng TM TNHH MTV Đại Dương",                  bin: "970414", logo: "https://api.vietqr.io/img/OCEAN.png" },
  { code: "VCBN", shortName: "Vietcombank Neo", name: "Vietcombank Neo",                               bin: "970436", logo: "https://api.vietqr.io/img/VCB.png" },
  { code: "KLB",  shortName: "KienlongBank", name: "Ngân hàng TMCP Kiên Long",                          bin: "970452", logo: "https://api.vietqr.io/img/KLB.png" },
  { code: "VBB",  shortName: "VietBank",     name: "Ngân hàng TMCP Việt Nam Thương Tín",               bin: "970433", logo: "https://api.vietqr.io/img/VBB.png" },
  { code: "VRB",  shortName: "VRB",          name: "Ngân hàng Liên doanh Việt - Nga",                  bin: "970421", logo: "https://api.vietqr.io/img/VRB.png" },
  { code: "WOO",  shortName: "Woori",        name: "Ngân hàng Woori Việt Nam",                          bin: "970457", logo: "https://api.vietqr.io/img/WVN.png" },
  { code: "UOB",  shortName: "UOB",          name: "Ngân hàng UOB Việt Nam",                            bin: "970458", logo: "https://api.vietqr.io/img/UOB.png" },
  { code: "SCVN", shortName: "Standard Chartered", name: "Ngân hàng Standard Chartered Việt Nam",       bin: "970410", logo: "https://api.vietqr.io/img/SCVN.png" },
  { code: "PVCB", shortName: "PVcomBank",    name: "Ngân hàng TMCP Đại Chúng Việt Nam",                bin: "970412", logo: "https://api.vietqr.io/img/PVCB.png" },
  { code: "NCB",  shortName: "NCB",          name: "Ngân hàng TMCP Quốc Dân",                          bin: "970419", logo: "https://api.vietqr.io/img/NCB.png" },
  { code: "SHBVN", shortName: "Shinhan Bank", name: "Ngân hàng Shinhan Việt Nam",                       bin: "970424", logo: "https://api.vietqr.io/img/SHBVN.png" },
  { code: "HSBC", shortName: "HSBC Vietnam", name: "Ngân hàng HSBC Việt Nam",                          bin: "458761", logo: "https://api.vietqr.io/img/HSBC.png" },
  { code: "CAKE", shortName: "CAKE",         name: "Ngân hàng số CAKE by VPBank",                       bin: "546034", logo: "https://api.vietqr.io/img/CAKE.png" },
  { code: "UBANK", shortName: "Ubank",       name: "Ngân hàng số Ubank by VPBank",                      bin: "546035", logo: "https://api.vietqr.io/img/UBANK.png" },
  { code: "TIMO", shortName: "Timo",         name: "Ngân hàng số Timo by BVBank",                       bin: "963388", logo: "https://api.vietqr.io/img/TIMO.png" },
] as const;

export function findBankByCode(code: string): BankEntry | null {
  return VN_BANKS.find((b) => b.code === code) ?? null;
}
