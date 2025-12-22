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
  nav: {
    home: string;
    live: string;
    videos: string;
    tournaments: string;
    search: string;
    profile: string;
    login: string;
    logout: string;
    signup: string;
    creator: string;
    admin: string;
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
  nav: {
    home: "Trang chủ",
    live: "Trực tiếp",
    videos: "Video",
    tournaments: "Giải đấu",
    search: "Tìm kiếm",
    profile: "Tài khoản",
    login: "Đăng nhập",
    logout: "Đăng xuất",
    signup: "Đăng ký",
    creator: "Creator Studio",
    admin: "Quản trị",
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
};
