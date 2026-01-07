// Translation structure type
export interface Translations {
  common: {
    appName: string;
    loading: string;
    error: string;
    retry: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    search: string;
    viewAll: string;
    share: string;
    copyLink: string;
    copied: string;
    noResults: string;
    comingSoon: string;
  };
  privacy: {
    title: string;
    intro: {
      title: string;
      description: string;
      commitment: string;
    };
    dataCollection: {
      title: string;
      description: string;
      items: {
        email: string;
        displayName: string;
        avatar: string;
        usage: string;
      };
    };
    purpose: {
      title: string;
      items: {
        auth: string;
        tournament: string;
        display: string;
        improve: string;
      };
    };
    sharing: {
      title: string;
      description: string;
      items: {
        oauth: string;
        legal: string;
      };
    };
    security: {
      title: string;
      items: {
        storage: string;
        measures: string;
        access: string;
      };
    };
    rights: {
      title: string;
      description: string;
      items: {
        view: string;
        edit: string;
        stop: string;
      };
    };
    contact: {
      title: string;
      description: string;
    };
    effective: {
      text: string;
      update: string;
    };
  };
  nav: {
    home: string;
    live: string;
    videos: string;
    tournaments: string;
    tools: string;
    search: string;
    profile: string;
    login: string;
    logout: string;
    signup: string;
    creator: string;
    admin: string;
  };
  tools: {
    title: string;
    description: string;
    quickTable: {
      title: string;
      description: string;
    };
    teamMatch: {
      title: string;
      description: string;
    };
    singleElimination: {
      title: string;
      description: string;
    };
    doublesElimination: {
      title: string;
      description: string;
    };
    comingSoon: string;
  };
  auth: {
    login: string;
    signup: string;
    email: string;
    password: string;
    confirmPassword: string;
    forgotPassword: string;
    resetPassword: string;
    orContinueWith: string;
    noAccount: string;
    hasAccount: string;
    loginSuccess: string;
    logoutSuccess: string;
    signupSuccess: string;
    invalidCredentials: string;
    accessDenied: string;
    loginRequired: string;
    continueWithGoogle: string;
    emailNotVerified: string;
    emailNotVerifiedDesc: string;
    resendVerification: string;
    verificationSent: string;
    verificationSentDesc: string;
    emailAlreadyUsed: string;
    emailAlreadyUsedDesc: string;
  };
  home: {
    hero: {
      title: string;
      subtitle: string;
      description: string;
      cta: string;
    };
    sections: {
      liveNow: string;
      latestVideos: string;
      popularThisWeek: string;
      tournaments: string;
      organizations: string;
    };
    noLive: string;
    noVideos: string;
  };
  video: {
    watch: string;
    duration: string;
    views: string;
    likes: string;
    comments: string;
    publishedAt: string;
    relatedVideos: string;
    shorts: string;
    longform: string;
    noDescription: string;
  };
  live: {
    live: string;
    watching: string;
    scheduled: string;
    ended: string;
    startingSoon: string;
    watchLive: string;
    noLivestreams: string;
    scheduledFor: string;
    replay: string;
  };
  tournament: {
    title: string;
    upcoming: string;
    ongoing: string;
    ended: string;
    startDate: string;
    endDate: string;
    viewTournament: string;
    relatedContent: string;
    follow: string;
    remindMe: string;
    liveNow: string;
    scheduled: string;
    replays: string;
    videos: string;
    allVideos: string;
    shortVideos: string;
    longVideos: string;
    noLive: string;
    noScheduled: string;
    noReplays: string;
    noVideos: string;
    checkBackLater: string;
  };
  organization: {
    title: string;
    videos: string;
    livestreams: string;
    about: string;
    noDescription: string;
    noContent: string;
    followForUpdates: string;
  };
  comments: {
    title: string;
    placeholder: string;
    submit: string;
    loginToComment: string;
    noComments: string;
    delete: string;
    deleted: string;
  };
  creator: {
    dashboard: string;
    overview: string;
    videos: string;
    livestreams: string;
    settings: string;
    upload: string;
    createLive: string;
    noOrganization: string;
    stats: {
      totalViews: string;
      totalLikes: string;
      totalVideos: string;
      totalLivestreams: string;
    };
    video: {
      title: string;
      description: string;
      type: string;
      short: string;
      long: string;
      status: string;
      draft: string;
      published: string;
      hidden: string;
      tags: string;
      tournament: string;
      thumbnail: string;
      uploadVideo: string;
      uploading: string;
      uploadSuccess: string;
      uploadError: string;
      selectFile: string;
      dragDrop: string;
      generatingThumbnail: string;
      thumbnailGenerated: string;
      regenerateThumbnail: string;
      thumbnailPreview: string;
    };
    livestream: {
      title: string;
      description: string;
      scheduledStart: string;
      streamKey: string;
      rtmpUrl: string;
      playbackUrl: string;
      copyStreamKey: string;
      goLive: string;
      endStream: string;
      createSuccess: string;
      streamInfo: string;
    };
  };
  admin: {
    dashboard: string;
    overview: string;
    organizations: string;
    users: string;
    tournaments: string;
    stats: {
      totalUsers: string;
      totalOrganizations: string;
      totalVideos: string;
      totalLivestreams: string;
    };
    organization: {
      create: string;
      edit: string;
      name: string;
      slug: string;
      logo: string;
      description: string;
      creators: string;
      addCreator: string;
      removeCreator: string;
    };
    user: {
      email: string;
      displayName: string;
      role: string;
      organization: string;
      changeRole: string;
      assignOrg: string;
      viewer: string;
      creator: string;
      admin: string;
    };
    tournament: {
      create: string;
      edit: string;
      name: string;
      slug: string;
      startDate: string;
      endDate: string;
      status: string;
      description: string;
    };
    moderation: {
      title: string;
      pendingReview: string;
      approved: string;
      rejected: string;
      approve: string;
      reject: string;
      hide: string;
      reportedContent: string;
    };
  };
  player: {
    tapToPlayVideo: string;
    tapToWatchLive: string;
    notReady: string;
    playbackError: string;
    playbackErrorDesc: string;
  };
  errors: {
    notFound: string;
    notFoundDesc: string;
    serverError: string;
    serverErrorDesc: string;
    networkError: string;
    networkErrorDesc: string;
    goHome: string;
    error: string;
  };
  ads: {
    advertisement: string;
    skip: string;
  };
  search: {
    title: string;
    placeholder: string;
    filterAll: string;
    allTournaments: string;
    sortNewest: string;
    sortUpcoming: string;
    noResults: string;
    tryDifferent: string;
    resultsCount: string;
    enterKeyword: string;
    tabs: {
      all: string;
      videos: string;
      livestreams: string;
      tournaments: string;
    };
  };
  follow: {
    follow: string;
    following: string;
    unfollow: string;
  };
  notifications: {
    title: string;
    noNotifications: string;
    noNotificationsDesc: string;
    unread: string;
    markAllRead: string;
    livestreamScheduled: string;
    livestreamLive: string;
  };
  chat: {
    title: string;
    send: string;
    placeholder: string;
    signInToChat: string;
    chatDisabled: string;
    slowMode: string;
    slowModeWait: string;
    settings: string;
    mute: string;
    userMuted: string;
    youAreMuted: string;
    delete: string;
    enableChat: string;
    disableChat: string;
    noMessages: string;
    off: string;
    minutes: string;
    hour: string;
    hours: string;
    sendError: string;
    sending: string;
    sendFailed: string;
    retry: string;
    copy: string;
    loadOlder: string;
    newMessages: string;
  };
  analytics: {
    title: string;
    description: string;
    totalViews: string;
    totalLivestreams: string;
    totalVideos: string;
    followers: string;
    viewsOverTime: string;
    topContent: string;
    viewsByType: string;
    views: string;
    video: string;
    livestream: string;
    days: string;
    noData: string;
    noDataDesc: string;
    noViewData: string;
    noContent: string;
  };
  share: {
    share: string;
    shareTitle: string;
    copied: string;
    copiedDesc: string;
    linkDesc: string;
    embedDesc: string;
    withTitle: string;
    withoutTitle: string;
    qrDesc: string;
    downloadQR: string;
    qrDownloaded: string;
    qrDownloadedDesc: string;
  };
  quickTable: {
    title: string;
    description: string;
    loginRequired: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step3Title: string;
    tournamentName: string;
    tournamentNamePlaceholder: string;
    playerCount: string;
    playerCountPlaceholder: string;
    requireRegistration: string;
    requireRegistrationDesc: string;
    requireSkillLevel: string;
    requireSkillLevelDesc: string;
    advancedSettings: string;
    autoApprove: string;
    autoApproveDesc: string;
    doublesMode: string;
    doublesModeDesc: string;
    registrationMessage: string;
    registrationMessagePlaceholder: string;
    continue: string;
    back: string;
    roundRobin: string;
    roundRobinDesc: string;
    largePlayoff: string;
    largePlayoffDesc: string;
    recommended: string;
    notAvailableOver48: string;
    onlyAvailableOver32: string;
    status: {
      setup: string;
      groupStage: string;
      playoff: string;
      completed: string;
    };
    myTournaments: string;
    refereeTournaments: string;
    yourRegisteredTournaments: string;
    yourCompletedTournaments: string;
    openRegistrationTournaments: string;
    ongoing: string;
    completed: string;
    noOngoing: string;
    noCompleted: string;
    noTournaments: string;
    moreRemaining: string;
    players: string;
    approved: string;
    pending: string;
    rejected: string;
    showMore: string;
    showLess: string;
    showCompleted: string;
    hideCompleted: string;
    referee: string;
    noRating: string;
    viewProfile: string;
    editSkillLevel: string;
    btcNote: string;
    actions: string;
    approve: string;
    reject: string;
    cancelApproval: string;
    pendingRegistrations: string;
    approvedPlayers: string;
    rejectedRegistrations: string;
    loading: string;
    readyToBracket: string;
    readyToBracketDesc: string;
    createBracket: string;
    needMinPlayers: string;
    approveSelected: string;
    // Registration / Pairing
    registration: {
      title: string;
      doublesTitle: string;
      displayName: string;
      teamClub: string;
      skillLevel: string;
      dupr: string;
      duprDesc: string;
      otherSystem: string;
      otherSystemDesc: string;
      noRating: string;
      noRatingDesc: string;
      systemName: string;
      systemNamePlaceholder: string;
      duprScore: string;
      duprLink: string;
      skillScore: string;
      skillDescription: string;
      submit: string;
      submitting: string;
      afterRegisterNote: string;
      waitingApproval: string;
      approved: string;
      rejected: string;
      rejectedMessage: string;
    };
    pairing: {
      pairUp: string;
      confirmPair: string;
      confirmPairWith: string;
      cancel: string;
      confirm: string;
      sending: string;
      waitingConfirm: string;
      waitingYourConfirm: string;
      accept: string;
      decline: string;
      incomingRequests: string;
      outgoingRequests: string;
      availablePlayers: string;
      noPartner: string;
      hasPartner: string;
      removePartner: string;
      teamLocked: string;
    };
    allRegistered: string;
    yourTeam: string;
    teamLeader: string;
    partner: string;
    manageTeam: string;
    registerDesc: string;
    alreadyRegistered: string;
    loginToRegister: string;
    login: string;
    removePartnerConfirm: string;
    remove: string;
    waitingForApproval: string;
    waitingPartnerApproval: string;
    skillDescOptions: string[];
    exampleClub: string;
    exampleDuprLink: string;
    exampleSkillDesc: string;
    registeredPlayers: string;
    noRegisteredPlayers: string;
    teamName: string;
    playerName: string;
    club: string;
    notDeclared: string;
    hasPartnerStatus: string;
    noPartnerStatus: string;
    statusHeader: string;
    // Playoff bracket
    playoff: {
      noMatches: string;
      champion: string;
      match: string;
      final: string;
      semiFinal: string;
      quarterFinal: string;
      round16: string;
      round: string;
      group: string;
      enterNextRound: string;
      inputScore: string;
      editScore: string;
      openScoring: string;
      tieNotAllowed: string;
    };
    // Quota / soft launch
    quota: {
      usage: string;
      limitReached: string;
      limitReachedDesc: string;
      contactUs: string;
    };
  };
}

// Vietnamese translations
export const vi: Translations = {
  common: {
    appName: "The Pickle Hub",
    loading: "Đang tải...",
    error: "Có lỗi xảy ra",
    retry: "Thử lại",
    save: "Lưu",
    cancel: "Hủy",
    delete: "Xóa",
    edit: "Chỉnh sửa",
    create: "Tạo mới",
    search: "Tìm kiếm",
    viewAll: "Xem tất cả",
    share: "Chia sẻ",
    copyLink: "Sao chép liên kết",
    copied: "Đã sao chép!",
    noResults: "Không có kết quả",
    comingSoon: "Sắp ra mắt",
  },
  privacy: {
    title: "Chính sách bảo mật – The Pickle Hub",
    intro: {
      title: "Giới thiệu",
      description: "The Pickle Hub là nền tảng video, livestream và công cụ tổ chức giải đấu Pickleball.",
      commitment: "Chúng tôi tôn trọng quyền riêng tư của người dùng và cam kết bảo vệ dữ liệu cá nhân.",
    },
    dataCollection: {
      title: "Thông tin chúng tôi thu thập",
      description: "Chúng tôi chỉ thu thập các dữ liệu cần thiết để cung cấp dịch vụ:",
      items: {
        email: "Email",
        displayName: "Tên hiển thị / username",
        avatar: "Ảnh đại diện (nếu đăng nhập bằng Google)",
        usage: "Dữ liệu sử dụng liên quan đến giải đấu, chia bảng, video và livestream",
      },
    },
    purpose: {
      title: "Mục đích sử dụng dữ liệu",
      items: {
        auth: "Xác thực tài khoản người dùng",
        tournament: "Cho phép tạo và quản lý giải đấu",
        display: "Hiển thị bảng xếp hạng, kết quả thi đấu",
        improve: "Cải thiện trải nghiệm người dùng",
      },
    },
    sharing: {
      title: "Chia sẻ dữ liệu",
      description: "Chúng tôi không bán hoặc chia sẻ dữ liệu cá nhân cho bên thứ ba. Chỉ chia sẻ với:",
      items: {
        oauth: "Nhà cung cấp xác thực (Google) để đăng nhập",
        legal: "Cơ quan pháp luật khi có yêu cầu hợp lệ",
      },
    },
    security: {
      title: "Bảo mật dữ liệu",
      items: {
        storage: "Dữ liệu được lưu trữ an toàn trên hạ tầng đám mây",
        measures: "Áp dụng các biện pháp bảo mật tiêu chuẩn ngành",
        access: "Giới hạn quyền truy cập dữ liệu cho nhân viên cần thiết",
      },
    },
    rights: {
      title: "Quyền của người dùng",
      description: "Bạn có quyền:",
      items: {
        view: "Xem thông tin cá nhân của mình",
        edit: "Yêu cầu chỉnh sửa hoặc xoá tài khoản",
        stop: "Ngừng sử dụng dịch vụ bất kỳ lúc nào",
      },
    },
    contact: {
      title: "Liên hệ",
      description: "Nếu bạn có câu hỏi về chính sách bảo mật, vui lòng liên hệ:",
    },
    effective: {
      text: "Chính sách này có hiệu lực từ ngày {date}.",
      update: "Chính sách có thể được cập nhật khi nền tảng phát triển thêm tính năng mới.",
    },
  },
  nav: {
    home: "Trang chủ",
    live: "Trực tiếp",
    videos: "Video",
    tournaments: "Giải đấu",
    tools: "Công cụ",
    search: "Tìm kiếm",
    profile: "Tài khoản",
    login: "Đăng nhập",
    logout: "Đăng xuất",
    signup: "Đăng ký",
    creator: "Creator Studio",
    admin: "Quản trị",
  },
  tools: {
    title: "Công cụ",
    description: "Các công cụ hỗ trợ tổ chức giải đấu Pickleball",
    quickTable: {
      title: "Chia bảng nhanh",
      description: "Chia bảng vòng tròn, playoff cho giải đấu nghiệp dư",
    },
    teamMatch: {
      title: "Đồng đội MLP",
      description: "Thi đấu theo đội kiểu Major League Pickleball",
    },
    singleElimination: {
      title: "Single Elimination",
      description: "Loại trực tiếp đơn giản",
    },
    doublesElimination: {
      title: "Doubles Elimination",
      description: "Loại kép với nhánh thắng/thua",
    },
    comingSoon: "Sắp ra mắt",
  },
  auth: {
    login: "Đăng nhập",
    signup: "Đăng ký tài khoản",
    email: "Email",
    password: "Mật khẩu",
    confirmPassword: "Xác nhận mật khẩu",
    forgotPassword: "Quên mật khẩu?",
    resetPassword: "Đặt lại mật khẩu",
    orContinueWith: "hoặc tiếp tục với",
    noAccount: "Chưa có tài khoản?",
    hasAccount: "Đã có tài khoản?",
    loginSuccess: "Đăng nhập thành công",
    logoutSuccess: "Đã đăng xuất",
    signupSuccess: "Đăng ký thành công! Vui lòng kiểm tra email để xác thực.",
    invalidCredentials: "Email hoặc mật khẩu không đúng",
    accessDenied: "Bạn không có quyền truy cập trang này",
    loginRequired: "Vui lòng đăng nhập để tiếp tục",
    continueWithGoogle: "Tiếp tục với Google",
    emailNotVerified: "Email chưa được xác thực",
    emailNotVerifiedDesc: "Vui lòng kiểm tra email để xác thực tài khoản trước khi đăng nhập.",
    resendVerification: "Gửi lại email xác thực",
    verificationSent: "Đã gửi email xác thực",
    verificationSentDesc: "Vui lòng kiểm tra hộp thư đến (và thư rác) để xác thực tài khoản.",
    emailAlreadyUsed: "Email đã được sử dụng",
    emailAlreadyUsedDesc: "Vui lòng đăng nhập hoặc sử dụng email khác.",
  },
  home: {
    hero: {
      title: "The Pickle Hub",
      subtitle: "Nền tảng media chuyên nghiệp về Pickleball",
      description: "Livestream trực tiếp và video theo yêu cầu từ các giải đấu hàng đầu",
      cta: "Khám phá ngay",
    },
    sections: {
      liveNow: "Đang phát trực tiếp",
      latestVideos: "Video mới nhất",
      popularThisWeek: "Phổ biến tuần này",
      tournaments: "Giải đấu",
      organizations: "Tổ chức",
    },
    noLive: "Hiện không có livestream nào",
    noVideos: "Chưa có video nào",
  },
  video: {
    watch: "Xem video",
    duration: "Thời lượng",
    views: "lượt xem",
    likes: "lượt thích",
    comments: "bình luận",
    publishedAt: "Đăng ngày",
    relatedVideos: "Video liên quan",
    shorts: "Video ngắn",
    longform: "Video dài",
    noDescription: "Không có mô tả",
  },
  live: {
    live: "TRỰC TIẾP",
    watching: "đang xem",
    scheduled: "Đã lên lịch",
    ended: "Đã kết thúc",
    startingSoon: "Sắp bắt đầu",
    watchLive: "Xem trực tiếp",
    noLivestreams: "Không có livestream nào",
    scheduledFor: "Bắt đầu lúc",
    replay: "Xem lại",
  },
  tournament: {
    title: "Giải đấu",
    upcoming: "Sắp diễn ra",
    ongoing: "Đang diễn ra",
    ended: "Đã kết thúc",
    startDate: "Ngày bắt đầu",
    endDate: "Ngày kết thúc",
    viewTournament: "Xem giải đấu",
    relatedContent: "Nội dung liên quan",
    follow: "Theo dõi",
    remindMe: "Nhắc tôi",
    liveNow: "Đang trực tiếp",
    scheduled: "Sắp diễn ra",
    replays: "Xem lại",
    videos: "Video",
    allVideos: "Tất cả",
    shortVideos: "Ngắn",
    longVideos: "Dài",
    noLive: "Không có livestream đang phát",
    noScheduled: "Chưa có lịch phát sóng",
    noReplays: "Chưa có video xem lại",
    noVideos: "Chưa có video",
    checkBackLater: "Quay lại sau để xem nội dung mới",
  },
  organization: {
    title: "Đơn vị",
    videos: "Video",
    livestreams: "Livestream",
    about: "Giới thiệu",
    noDescription: "Chưa có thông tin giới thiệu",
    noContent: "Chưa có nội dung",
    followForUpdates: "Theo dõi để nhận thông báo khi có nội dung mới",
  },
  comments: {
    title: "Bình luận",
    placeholder: "Viết bình luận...",
    submit: "Gửi",
    loginToComment: "Đăng nhập để bình luận",
    noComments: "Chưa có bình luận nào",
    delete: "Xóa bình luận",
    deleted: "Bình luận đã bị xóa",
  },
  creator: {
    dashboard: "Creator Studio",
    overview: "Tổng quan",
    videos: "Video của tôi",
    livestreams: "Livestream",
    settings: "Cài đặt",
    upload: "Tải lên video",
    createLive: "Tạo livestream",
    noOrganization: "Bạn chưa được gán vào tổ chức nào. Vui lòng liên hệ admin.",
    stats: {
      totalViews: "Tổng lượt xem",
      totalLikes: "Tổng lượt thích",
      totalVideos: "Số video",
      totalLivestreams: "Số livestream",
    },
    video: {
      title: "Tiêu đề",
      description: "Mô tả",
      type: "Loại video",
      short: "Video ngắn",
      long: "Video dài",
      status: "Trạng thái",
      draft: "Bản nháp",
      published: "Đã xuất bản",
      hidden: "Đã ẩn",
      tags: "Thẻ tag",
      tournament: "Giải đấu",
      thumbnail: "Ảnh thumbnail",
      uploadVideo: "Tải lên video",
      uploading: "Đang tải lên...",
      uploadSuccess: "Tải lên thành công!",
      uploadError: "Tải lên thất bại",
      selectFile: "Chọn file video",
      dragDrop: "hoặc kéo thả file vào đây",
      generatingThumbnail: "Đang tạo thumbnail...",
      thumbnailGenerated: "Đã tạo thumbnail",
      regenerateThumbnail: "Tạo lại thumbnail",
      thumbnailPreview: "Xem trước thumbnail",
    },
    livestream: {
      title: "Tiêu đề",
      description: "Mô tả",
      scheduledStart: "Thời gian bắt đầu",
      streamKey: "Stream Key",
      rtmpUrl: "RTMP URL",
      playbackUrl: "Playback URL",
      copyStreamKey: "Sao chép Stream Key",
      goLive: "Bắt đầu phát",
      endStream: "Kết thúc phát",
      createSuccess: "Tạo livestream thành công!",
      streamInfo: "Thông tin stream",
    },
  },
  admin: {
    dashboard: "Bảng điều khiển Admin",
    overview: "Tổng quan",
    organizations: "Tổ chức",
    users: "Người dùng",
    tournaments: "Giải đấu",
    stats: {
      totalUsers: "Tổng người dùng",
      totalOrganizations: "Tổng tổ chức",
      totalVideos: "Tổng video",
      totalLivestreams: "Tổng livestream",
    },
    organization: {
      create: "Tạo tổ chức",
      edit: "Chỉnh sửa tổ chức",
      name: "Tên tổ chức",
      slug: "Slug",
      logo: "Logo",
      description: "Mô tả",
      creators: "Creators",
      addCreator: "Thêm creator",
      removeCreator: "Xóa creator",
    },
    user: {
      email: "Email",
      displayName: "Tên hiển thị",
      role: "Vai trò",
      organization: "Tổ chức",
      changeRole: "Đổi vai trò",
      assignOrg: "Gán tổ chức",
      viewer: "Viewer",
      creator: "Creator",
      admin: "Admin",
    },
    tournament: {
      create: "Tạo giải đấu",
      edit: "Chỉnh sửa giải đấu",
      name: "Tên giải đấu",
      slug: "Slug",
      startDate: "Ngày bắt đầu",
      endDate: "Ngày kết thúc",
      status: "Trạng thái",
      description: "Mô tả",
    },
    moderation: {
      title: "Kiểm duyệt",
      pendingReview: "Chờ duyệt",
      approved: "Đã duyệt",
      rejected: "Đã từ chối",
      approve: "Duyệt",
      reject: "Từ chối",
      hide: "Ẩn nội dung",
      reportedContent: "Nội dung bị báo cáo",
    },
  },
  player: {
    tapToPlayVideo: "Chạm để xem video",
    tapToWatchLive: "Chạm để xem trực tiếp",
    notReady: "Video chưa sẵn sàng",
    playbackError: "Không thể phát",
    playbackErrorDesc: "Không thể phát trên trình duyệt này. Hãy thử reload hoặc đổi mạng.",
  },
  errors: {
    notFound: "Không tìm thấy trang",
    notFoundDesc: "Trang bạn đang tìm không tồn tại.",
    serverError: "Lỗi hệ thống",
    serverErrorDesc: "Đã có lỗi xảy ra. Vui lòng thử lại sau.",
    networkError: "Lỗi kết nối",
    networkErrorDesc: "Không thể kết nối đến máy chủ.",
    goHome: "Về trang chủ",
    error: "Lỗi",
  },
  ads: {
    advertisement: "Quảng cáo",
    skip: "Bỏ qua",
  },
  search: {
    title: "Tìm kiếm",
    placeholder: "Tìm video, livestream hoặc giải đấu...",
    filterAll: "Tất cả",
    allTournaments: "Tất cả giải đấu",
    sortNewest: "Mới nhất",
    sortUpcoming: "Sắp diễn ra",
    noResults: "Không tìm thấy kết quả",
    tryDifferent: "Thử từ khóa khác",
    resultsCount: "Tìm thấy {count} kết quả",
    enterKeyword: "Nhập từ khóa để tìm kiếm",
    tabs: {
      all: "Tất cả",
      videos: "Video",
      livestreams: "Livestream",
      tournaments: "Giải đấu",
    },
  },
  follow: {
    follow: "Theo dõi",
    following: "Đang theo dõi",
    unfollow: "Bỏ theo dõi",
  },
  notifications: {
    title: "Thông báo",
    noNotifications: "Không có thông báo",
    noNotificationsDesc: "Theo dõi creator hoặc giải đấu để nhận thông báo khi có livestream mới",
    unread: "chưa đọc",
    markAllRead: "Đánh dấu tất cả đã đọc",
    livestreamScheduled: "đã lên lịch livestream mới",
    livestreamLive: "đang phát trực tiếp!",
  },
  chat: {
    title: "Trò chuyện",
    send: "Gửi",
    placeholder: "Nhập tin nhắn...",
    signInToChat: "Đăng nhập để chat",
    chatDisabled: "Chat đang tắt",
    slowMode: "Chế độ chậm",
    slowModeWait: "Vui lòng chờ trước khi gửi tin nhắn tiếp",
    settings: "Cài đặt chat",
    mute: "Tắt tiếng",
    userMuted: "Đã tắt tiếng người dùng",
    youAreMuted: "Bạn đang bị tạm khóa chat đến",
    delete: "Xóa",
    enableChat: "Bật chat",
    disableChat: "Tắt chat",
    noMessages: "Chưa có tin nhắn nào",
    off: "Tắt",
    minutes: "phút",
    hour: "giờ",
    hours: "giờ",
    sendError: "Không thể gửi tin nhắn",
    sending: "Đang gửi...",
    sendFailed: "Gửi thất bại",
    retry: "Thử lại",
    copy: "Sao chép",
    loadOlder: "Tải tin cũ hơn",
    newMessages: "tin nhắn mới",
  },
  analytics: {
    title: "Analytics",
    description: "Theo dõi hiệu suất nội dung của bạn",
    totalViews: "Tổng lượt xem",
    totalLivestreams: "Tổng Livestream",
    totalVideos: "Tổng Video",
    followers: "Người theo dõi",
    viewsOverTime: "Lượt xem theo thời gian",
    topContent: "Nội dung nổi bật",
    viewsByType: "Lượt xem theo loại",
    views: "lượt xem",
    video: "Video",
    livestream: "Livestream",
    days: "ngày",
    noData: "Chưa có dữ liệu",
    noDataDesc: "Hãy bắt đầu livestream hoặc đăng video đầu tiên để theo dõi hiệu suất!",
    noViewData: "Chưa có lượt xem trong khoảng thời gian này",
    noContent: "Chưa có nội dung",
  },
  share: {
    share: "Chia sẻ",
    shareTitle: "Chia sẻ nội dung",
    copied: "Đã sao chép!",
    copiedDesc: "Link đã được sao chép vào clipboard",
    linkDesc: "Chia sẻ link này để mọi người có thể xem nội dung",
    embedDesc: "Sao chép mã iframe để nhúng video vào website của bạn",
    withTitle: "Có hiển thị tiêu đề",
    withoutTitle: "Không có tiêu đề",
    qrDesc: "Quét mã QR để mở nội dung trên điện thoại hoặc in ra cho sự kiện offline",
    downloadQR: "Tải mã QR",
    qrDownloaded: "Đã tải xuống!",
    qrDownloadedDesc: "Mã QR đã được lưu vào máy của bạn",
  },
  quickTable: {
    title: "Chia bảng nhanh",
    description: "Công cụ miễn phí giúp chia bảng, tạo danh sách trận đấu và tổ chức thi đấu phong trào.",
    loginRequired: "Vui lòng đăng nhập để tạo bảng đấu mới.",
    step1Title: "Bước 1: Thông tin giải đấu",
    step1Desc: "Nhập thông tin cơ bản về giải đấu",
    step2Title: "Bước 2: Chọn thể thức",
    step3Title: "Bước 3: Chia bảng",
    tournamentName: "Tên giải / bảng đấu",
    tournamentNamePlaceholder: "VD: Giải Pickleball Mùa Hè 2024",
    playerCount: "Số người chơi (dự kiến)",
    playerCountPlaceholder: "VD: 16",
    requireRegistration: "Yêu cầu VĐV đăng ký trước",
    requireRegistrationDesc: "VĐV phải đăng ký và được BTC duyệt trước khi vào danh sách thi đấu",
    requireSkillLevel: "Bắt buộc khai trình độ",
    requireSkillLevelDesc: "VĐV phải khai trình độ (DUPR hoặc tự mô tả)",
    advancedSettings: "Cài đặt nâng cao",
    autoApprove: "Tự động duyệt đăng ký",
    autoApproveDesc: "VĐV được duyệt ngay khi đăng ký (không khuyến nghị)",
    doublesMode: "Thi đấu đôi",
    doublesModeDesc: "VĐV đăng ký theo cặp đôi, có thể mời partner qua link",
    registrationMessage: "Thông báo cho VĐV khi đăng ký",
    registrationMessagePlaceholder: "VD: BTC sẽ xác nhận trình độ dựa vào điểm tự khai và đối chiếu với các hệ điểm...",
    continue: "Tiếp tục",
    back: "Quay lại",
    roundRobin: "Chia bảng (Round Robin)",
    roundRobinDesc: "Chia người chơi thành các bảng, mỗi người đấu với tất cả người khác trong bảng. Top của mỗi bảng sẽ vào vòng Playoff.",
    largePlayoff: "Playoff đông người",
    largePlayoffDesc: "Thể thức dành cho giải đông người. Lượt 1-2 ghi nhận thắng/thua và hiệu số, từ lượt 3 trở đi là single elimination.",
    recommended: "Khuyến nghị",
    notAvailableOver48: "Không khả dụng với >48 người",
    onlyAvailableOver32: "Chỉ khả dụng với ≥32 người",
    status: {
      setup: "Đang thiết lập",
      groupStage: "Vòng bảng",
      playoff: "Playoff",
      completed: "Hoàn thành",
    },
    myTournaments: "Giải đấu của tôi",
    refereeTournaments: "Giải đang điều hành",
    yourRegisteredTournaments: "Giải đấu bạn đang tham gia",
    yourCompletedTournaments: "Giải đấu đã tham gia",
    openRegistrationTournaments: "Giải đấu đang đăng ký",
    ongoing: "Đang diễn ra",
    completed: "Hoàn thành",
    noOngoing: "Không có giải đấu đang diễn ra",
    noCompleted: "Chưa có giải đấu nào hoàn thành",
    noTournaments: "Bạn chưa tạo bảng đấu nào",
    moreRemaining: "Còn {count} giải khác",
    players: "người",
    approved: "Đã duyệt",
    pending: "Chờ duyệt",
    rejected: "Từ chối",
    showMore: "Xem thêm",
    showLess: "Thu gọn",
    showCompleted: "Xem giải đã hoàn thành",
    hideCompleted: "Ẩn giải đã hoàn thành",
    referee: "Trọng tài",
    noRating: "Chưa có rating",
    viewProfile: "Xem hồ sơ",
    editSkillLevel: "Chỉnh sửa trình độ",
    btcNote: "Ghi chú BTC",
    actions: "Thao tác",
    approve: "Duyệt",
    reject: "Từ chối",
    cancelApproval: "Hủy duyệt",
    pendingRegistrations: "Đăng ký chờ duyệt",
    approvedPlayers: "VĐV đã duyệt",
    rejectedRegistrations: "Đã từ chối",
    loading: "Đang tải...",
    readyToBracket: "Sẵn sàng chia bảng!",
    readyToBracketDesc: "Đã có {count} VĐV được duyệt. Bạn có thể bắt đầu chia bảng.",
    createBracket: "Chia bảng",
    needMinPlayers: "Cần ít nhất 6 VĐV được duyệt để chia bảng. Hiện có {count}/6 VĐV.",
    approveSelected: "Duyệt {count} VĐV",
    // Registration / Pairing
    registration: {
      title: "Đăng ký tham dự",
      doublesTitle: "Đăng ký tham dự (Đội đôi)",
      displayName: "Tên hiển thị",
      teamClub: "Team / CLB (nếu có)",
      skillLevel: "Trình độ",
      dupr: "DUPR",
      duprDesc: "Hệ thống rating DUPR chính thức",
      otherSystem: "Hệ thống khác",
      otherSystemDesc: "UTPR, APP, hoặc hệ thống khác",
      noRating: "Tôi chưa có rating",
      noRatingDesc: "Bạn sẽ mô tả trình độ của mình",
      systemName: "Tên hệ thống",
      systemNamePlaceholder: "VD: UTPR, APP, WPR...",
      duprScore: "Điểm DUPR",
      duprLink: "Link hồ sơ DUPR",
      skillScore: "Điểm trình độ",
      skillDescription: "Mô tả trình độ",
      submit: "Đăng ký tham dự",
      submitting: "Đang gửi...",
      afterRegisterNote: "Sau khi đăng ký, bạn sẽ thấy danh sách VĐV chưa có partner và có thể gửi yêu cầu ghép đôi.",
      waitingApproval: "Bạn đang chờ BTC duyệt",
      approved: "Bạn đã được BTC duyệt",
      rejected: "Bạn đã bị từ chối tham gia giải",
      rejectedMessage: "Lý do",
    },
    pairing: {
      pairUp: "Ghép đôi",
      confirmPair: "Xác nhận ghép đôi",
      confirmPairWith: "Gửi yêu cầu ghép đôi với",
      cancel: "Hủy",
      confirm: "Xác nhận",
      sending: "Đang gửi...",
      waitingConfirm: "Đang chờ xác nhận",
      waitingYourConfirm: "Đang chờ bạn xác nhận",
      accept: "Chấp nhận",
      decline: "Từ chối",
      incomingRequests: "Có người đang chờ ghép đôi với bạn",
      outgoingRequests: "Yêu cầu ghép đôi đã gửi",
      availablePlayers: "VĐV chưa có partner",
      noPartner: "Chưa có partner",
      hasPartner: "Đã có partner",
      removePartner: "Xóa partner",
      teamLocked: "Giải đấu đã diễn ra. Không thể thay đổi đội.",
    },
    allRegistered: "Các VĐV đã đăng ký",
    yourTeam: "Đội của bạn",
    teamLeader: "VĐV 1 (Đội trưởng)",
    partner: "Partner",
    manageTeam: "Quản lý đội và ghép đôi với VĐV khác",
    registerDesc: "Đăng ký tham gia giải",
    alreadyRegistered: "Bạn đã đăng ký tham gia giải này rồi",
    loginToRegister: "Vui lòng đăng nhập để đăng ký tham dự giải",
    login: "Đăng nhập",
    removePartnerConfirm: "Bạn có chắc muốn xóa partner khỏi đội?",
    remove: "Xóa",
    waitingForApproval: "Đội trưởng có thể quản lý đội và thay đổi partner.",
    waitingPartnerApproval: "Đang chờ",
    skillDescOptions: ["Mới chơi ~6 tháng", "Chơi phong trào", "Chơi thường xuyên ~1-2 năm", "Đã thi đấu nhiều giải"],
    exampleClub: "VD: CLB Pickleball Quận 1",
    exampleDuprLink: "https://mydupr.com/profile/...",
    exampleSkillDesc: "Hoặc mô tả theo cách của bạn...",
    registeredPlayers: "VĐV đã đăng kí",
    noRegisteredPlayers: "Chưa có VĐV nào đăng kí",
    teamName: "Tên đội",
    playerName: "Tên VĐV",
    club: "Team/CLB",
    notDeclared: "Chưa khai",
    hasPartnerStatus: "Đã có partner",
    noPartnerStatus: "Chưa có partner",
    statusHeader: "Trạng thái",
    // Playoff bracket
    playoff: {
      noMatches: "Chưa có trận playoff",
      champion: "Nhà vô địch",
      match: "Trận",
      final: "Chung kết",
      semiFinal: "Bán kết",
      quarterFinal: "Tứ kết",
      round16: "Vòng 16",
      round: "Vòng loại",
      group: "Bảng",
      enterNextRound: "Nhập kết quả vòng trước để mở vòng tiếp theo",
      inputScore: "Nhập",
      editScore: "Sửa",
      openScoring: "Mở trang chấm điểm",
      tieNotAllowed: "Không cho phép tỉ số hòa",
    },
    // Quota / soft launch
    quota: {
      usage: "Bạn đã tạo {count}/3 giải",
      limitReached: "Đã đạt giới hạn soft launch",
      limitReachedDesc: "Giai đoạn soft launch: mỗi tài khoản chỉ được tạo tối đa 3 giải.",
      contactUs: "Liên hệ",
    },
  },
};
