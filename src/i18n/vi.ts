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
    close: string;
    loadMore: string;
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
  terms: {
    title: string;
    intro: {
      title: string;
      description: string;
      acceptance: string;
    };
    account: {
      title: string;
      items: {
        age: string;
        accuracy: string;
        security: string;
        responsibility: string;
      };
    };
    acceptableUse: {
      title: string;
      description: string;
      items: {
        noIllegal: string;
        noHarassment: string;
        noSpam: string;
        noImpersonation: string;
        noMalware: string;
      };
    };
    userContent: {
      title: string;
      description: string;
      items: {
        ownership: string;
        license: string;
        moderation: string;
      };
    };
    intellectualProperty: {
      title: string;
      description: string;
    };
    liability: {
      title: string;
      description: string;
      items: {
        asIs: string;
        noWarranty: string;
        limitation: string;
      };
    };
    termination: {
      title: string;
      description: string;
      items: {
        userRight: string;
        platformRight: string;
        effect: string;
      };
    };
    changes: {
      title: string;
      description: string;
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
  report: {
    report: string;
    title: string;
    description: string;
    submit: string;
    success: string;
    error: string;
    alreadyReported: string;
    additionalInfo: string;
  };
  account: {
    changePassword: string;
    changePasswordDescription: string;
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
    passwordChanged: string;
    passwordChangeError: string;
    passwordMismatch: string;
    passwordTooShort: string;
    deleteAccount: string;
    deleteAccountTitle: string;
    deleteAccountWarning: string;
    deleteDataProfile: string;
    deleteDataTournaments: string;
    deleteDataContent: string;
    deleteAccountIrreversible: string;
    deleteConfirmInstruction: string;
    deleteAccountConfirm: string;
  };
  nav: {
    home: string;
    live: string;
    videos: string;
    tournaments: string;
    tools: string;
    feed: string;
    /** Bottom-nav primary slot — replaces the tournaments tile. */
    social: string;
    search: string;
    profile: string;
    viewProfile: string;
    login: string;
    logout: string;
    signup: string;
    creator: string;
    admin: string;
    openMenu: string;
    closeMenu: string;
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
    flexTournament: {
      title: string;
      description: string;
      subtitle: string;
      subtitleFull: string;
      create: string;
      tournamentName: string;
      tournamentNamePlaceholder: string;
      addPlayers: string;
      addPlayersPlaceholder: string;
      addPlayersHint: string;
      playerPool: string;
      addTeam: string;
      addGroup: string;
      addMatch: string;
      teamName: string;
      groupName: string;
      matchName: string;
      matchType: {
        label: string;
        singles: string;
        doubles: string;
      };
      stats: {
        playerStats: string;
        pairStats: string;
        wins: string;
        losses: string;
        pointDiff: string;
        rank: string;
        name: string;
        pair: string;
      };
      generateRR: string;
      unlisted: string;
      public: string;
      slotA: string;
      slotB: string;
      noPlayers: string;
      noTeams: string;
      noGroups: string;
      noMatches: string;
      dropPlayerHere: string;
      dropTeamHere: string;
      score: string;
      vs: string;
      deleteConfirm: string;
      myTournaments: string;
      createNew: string;
      noTournaments: string;
      viewTournament: string;
      share: string;
      settings: string;
      visibility: string;
      visibilityHint: string;
      deleteError: string;
      createError: string;
      createSuccess: string;
      updateSuccess: string;
      generating: string;
      rrGenerated: string;
      duplicatePlayer: string;
      duplicateInTeam: string;
      duplicateInGroup: string;
      groupTypeMismatch: string;
      duplicateInMatch: string;
      includeDoublesInSingles: string;
      noDoublesStats: string;
      countsForStandings: string;
      noGroupHint: string;
      playerPanel: string;
      openPlayerPanel: string;
      teams: string;
      wins: string;
      tabTeams: string;
      tabGroups: string;
      tabMatches: string;
      groupTabTeams: string;
      groupTabIndividuals: string;
      selectTeamsToShow: string;
      allTeams: string;
      noPairStats: string;
      childMatch: string;
      addChildMatch: string;
      childMatches: string;
      selectPlayer: string;
      assignToGroup: string;
      noGroup: string;
      selectGroup: string;
    };
  };
  auth: {
    login: string;
    signup: string;
    email: string;
    password: string;
    confirmPassword: string;
    forgotPassword: string;
    forgotPasswordDesc: string;
    resetPassword: string;
    resetPasswordSent: string;
    resetPasswordSentDesc: string;
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
    // Sprint 3 PR #11 redesign — editorial Login surface
    tagline: string;
    continueWithApple: string;
    dividerWithEmail: string;
    privacyPolicy: string;
    passwordMinError: string;
  };
  moderation: {
    block: string;
    unblock: string;
    blocked: string;
    unblocked: string;
    blockedDesc: string;
    unblockedDesc: string;
    blockConfirm: string;
    unblockConfirm: string;
  };
  home: {
    hero: {
      title: string;
      subtitle: string;
      description: string;
      cta: string;
      badge: string;
      mainTitle: string;
      mainDescription: string;
    };
    sections: {
      liveNow: string;
      latestVideos: string;
      trendingVideos: string;
      popularThisWeek: string;
      tournaments: string;
      organizations: string;
      upcomingTournaments: string;
      upcomingSubtitle: string;
    };
    noLive: string;
    noVideos: string;
    features: {
      livestreamTitle: string;
      livestreamDesc: string;
      tournamentsTitle: string;
      tournamentsDesc: string;
      communityTitle: string;
      communityDesc: string;
    };
    about: {
      title: string;
      description: string;
      watchLive: string;
      tournaments: string;
      freeTools: string;
    };
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
    totalViews: string;
    endedAt: string;
    scheduled: string;
    ended: string;
    startingSoon: string;
    watchLive: string;
    noLivestreams: string;
    scheduledFor: string;
    replay: string;
    watchingTooltip: string;
    totalViewsTooltip: string;
    hubTitle: string;
    hubDescription: string;
    previewRemaining: string;
    previewEnded: string;
    signupToWatch: string;
    loginToWatch: string;
    createAccount: string;
    seo: {
      tournamentsTitle: string;
      tournamentsDesc: string;
      creatorsTitle: string;
      creatorsDesc: string;
      upcomingTitle: string;
      upcomingDesc: string;
    };
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
    hubTitle: string;
    hubDescription: string;
    seo: {
      createTitle: string;
      createDesc: string;
      formatsTitle: string;
      formatsDesc: string;
      builtTitle: string;
      builtDesc: string;
    };
    openRegistration: string;
    featured: string;
    multiEvent: string;
    pairs: string;
    players: string;
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
  geoBlock: {
    title: string;
    description: string;
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
    settings: {
      title: string;
      livestreamGate: string;
      requireLogin: string;
      requireLoginDesc: string;
      previewDuration: string;
      previewDurationDesc: string;
      appliesTo: string;
      appliesToAll: string;
      appliesToLive: string;
      appliesToReplay: string;
      savedSuccess: string;
      geoBlock: string;
      geoBlockEnabled: string;
      geoBlockEnabledDesc: string;
      blockedCountries: string;
      blockedCountriesDesc: string;
      tournamentGate: string;
      requireLoginTournament: string;
      requireLoginTournamentDesc: string;
    };
    viewers: {
      title: string;
      description: string;
      selectLivestream: string;
      selectPlaceholder: string;
      noActiveLivestreams: string;
      viewerList: string;
      viewer: string;
      watching: string;
      connected: string;
      disconnected: string;
      noViewers: string;
      anonymous: string;
      loggedIn: string;
      joinedAt: string;
      type: string;
    };
    auditLog: {
      title: string;
      description: string;
    };
  };
  player: {
    tapToPlayVideo: string;
    tapToWatchLive: string;
    notReady: string;
    playbackError: string;
    playbackErrorDesc: string;
    reconnecting: string;
    connectionLost: string;
    autoRetry: string;
    retryFailed: string;
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
    nickname: string;
    nicknamePlaceholder: string;
    nicknameUpdated: string;
    nicknameError: string;
    nicknameLengthError: string;
    nextEdit: string;
    pin: string;
    unpin: string;
    pinnedMessage: string;
    topChatters: string;
    messages: string;
    highlight: string;
    removeHighlight: string;
    like: string;
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
    socialLink: string;
    socialLinkDesc: string;
    directLink: string;
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
    openRegistrationTitle: string;
    expectedPlayers: string;
    expectedPairs: string;
    registering: string;
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
      disclaimer: string;
      pendingTitle: string;
      pendingDesc: string;
      approvedTitle: string;
      approvedDesc: string;
      approvedWaiting: string;
      infoTitle: string;
      infoName: string;
      cancelConfirm: string;
      cancelRegistration: string;
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
    // SEO content
    seo: {
      pageTitle: string;
      pageSubtitle: string;
      createTitle: string;
      createDesc: string;
      roundRobinTitle: string;
      roundRobinDesc: string;
      formatsTitle: string;
      formatsDesc: string;
    };
    // Setup UI
    setup: {
      inputPlayers: string;
      inputPlayersDesc: string;
      shuffle: string;
      playerNamePlaceholder: string;
      teamPlaceholder: string;
      seedPlaceholder: string;
      addPlayer: string;
      assignmentMethod: string;
      autoMode: string;
      autoModeDesc: string;
      manualMode: string;
      manualModeDesc: string;
      tips: string;
      tipTeam: string;
      tipSeed: string;
      tipAuto: string;
      tipManual: string;
      processing: string;
      continueManual: string;
      createBracketBtn: string;
      minPlayersError: string;
      notFound: string;
      notFoundDesc: string;
      createdSuccess: string;
      manualSuccess: string;
      errorOccurred: string;
    };
    manualAssignment: {
      title: string;
      description: string;
      guide: string;
      step1: string;
      step2: string;
      step3: string;
      unassigned: string;
      allAssigned: string;
      group: string;
      clickToAdd: string;
      noPlayers: string;
      warning: string;
      unbalancedGroups: string;
      sameTeamWarning: string;
      topSeedsWarning: string;
      confirm: string;
      remainingPlayers: string;
      emptyGroup: string;
    };
    view: {
      groupStage: string;
      shareSuccess: string;
      deleteConfirm: string;
      deleteBtn: string;
      groupCompleteTitle: string;
      groupCompleteDesc: string;
      startPlayoff: string;
      registrationTab: string;
      playoffTab: string;
      standings: string;
      player: string;
      wins: string;
      matches: string;
      pointDiff: string;
      actions: string;
      matchList: string;
      showTeam: string;
      courtTime: string;
      addPlayer: string;
      done: string;
      editGroups: string;
      movePlayer: string;
      removePlayer: string;
      removeConfirm: string;
      movePlayerTitle: string;
      selectGroup: string;
      moveBtn: string;
      movedSuccess: string;
      addPlayerTitle: string;
      playerName: string;
      team: string;
      addBtn: string;
      addedSuccess: string;
      removedSuccess: string;
      scoreUpdated: string;
      nextRoundCreated: string;
      tournamentCompleted: string;
      playoffCreated: string;
      onlyCreatorCanScore: string;
      wildcardTitle: string;
      wildcardDesc: string;
      selectExactly: string;
      courtsTimeUpdated: string;
      notFound: string;
      goBack: string;
      group: string;
      court: string;
      inputScore: string;
      loading: string;
      deleteTournament: string;
      deleteConfirmFull: string;
      recommended: string;
      confirm: string;
      cancel: string;
      move: string;
      add: string;
      save: string;
      enterName: string;
      enterTeam: string;
      addToGroup: string;
      moveToGroup: string;
      selectTargetGroup: string;
      addPlayerName: string;
      addPlayerTeam: string;
      editInlineScore: string;
      inputInlineScore: string;
      openScoringPage: string;
      cancelEdit: string;
      saveScore: string;
      errorOccurred: string;
      groupLabel: string;
      winsLabel: string;
      pointDiffLabel: string;
      courtName: string;
      courtNamePlaceholder: string;
      courtNameSaved: string;
    };
    parentTournament: {
      selectType: string;
      singleTitle: string;
      singleDesc: string;
      multiTitle: string;
      multiDesc: string;
      createParent: string;
      parentName: string;
      parentNamePlaceholder: string;
      eventDate: string;
      location: string;
      locationPlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
      addSubEvent: string;
      subEvents: string;
      noSubEvents: string;
      subEventCount: string;
      viewParent: string;
      deleteParentConfirm: string;
      moreEvents: string;
      noEventsYet: string;
      addFirstEvent: string;
    };
    playoffPreview: {
      title: string;
      subtitle: string;
      seed: string;
      fromGroup: string;
      conflictWarning: string;
      clickToSwap: string;
      autoResolve: string;
      confirmBracket: string;
      noConflicts: string;
      unresolvedConflicts: string;
    };
    groups: {
      groups: string;
      playersPerGroup: string;
      advanceToPlayoff: string;
      noConfig: string;
      tryOther: string;
      quotaUsed: string;
    };
    // Match Scoring Page
    matchScoring: {
      loading: string;
      matchNotFound: string;
      loadError: string;
      scoreUpdateError: string;
      noPermission: string;
      noPermissionDesc: string;
      backToBracket: string;
      goBack: string;
      live: string;
      ended: string;
      match: string;
      final: string;
      semiFinal: string;
      quarterFinal: string;
      round: string;
      claimSuccess: string;
      otherRefereeScoring: string;
      resetScore: string;
      resetConfirmTitle: string;
      resetConfirmDesc: string;
      resetSuccess: string;
      endMatch: string;
      endMatchConfirmTitle: string;
      endMatchConfirmDesc: string;
      finalResult: string;
      winner: string;
      tieWarning: string;
      confirm: string;
      cancel: string;
      endMatchSuccess: string;
      endMatchError: string;
      nextMatch: string;
      noNextMatch: string;
      // New keys for enhanced scoring
      swapSides: string;
      swapServe: string;
      undo: string;
      set: string;
      start: string;
      pause: string;
      serving: string;
      timeout: string;
      endSet: string;
      endSetConfirmTitle: string;
      endSetConfirmDesc: string;
      setWinner: string;
      matchWinner: string;
      bestOf: string;
      setsWon: string;
      currentSet: string;
      timerRunning: string;
      startMatch: string;
      timeoutExpired: string;
      timeoutExhausted: string;
      medicalExhausted: string;
      timeoutLabel: string;
      medicalLabel: string;
      endEarly: string;
      noteLeftPlaceholder: string;
      noteRightPlaceholder: string;
      serverNumberTitle: string;
      serverNumberServing: string;
      matchSettings: string;
      selectServingSide: string;
      timeoutsPerSide: string;
      medicalNote: string;
      defaultSets: string;
    };
  };
  // Team Match SEO
  teamMatch: {
    pageTitle: string;
    pageSubtitle: string;
    myTournaments: string;
    publicTournaments: string;
    noTournaments: string;
    createFirst: string;
    loginPrompt: string;
    createNew: string;
    viewDetails: string;
    confirmDelete: string;
    confirmDeleteDesc: string;
    cancel: string;
    delete: string;
    teams: string;
    players: string;
    formatRoundRobin: string;
    formatSingleElim: string;
    formatRrPlayoff: string;
    statusSetup: string;
    statusRegistration: string;
    statusOngoing: string;
    statusCompleted: string;
    seo: {
      mlpTitle: string;
      mlpDesc: string;
      lineupTitle: string;
      lineupDesc: string;
      manageTitle: string;
      manageDesc: string;
    };
    scoring: {
      title: string;
      saveScore: string;
      saving: string;
      saved: string;
      scoreSaveError: string;
      game: string;
      selectGame: string;
      matchComplete: string;
      reset: string;
      confirmReset: string;
    };
    setup: {
      title: string;
      subtitle: string;
      stepBasicInfo: string;
      stepGameTemplates: string;
      stepDreambreaker: string;
      stepFormat: string;
      tournamentName: string;
      tournamentNamePlaceholder: string;
      playersPerTeam: string;
      teamCount: string;
      requireRegistration: string;
      requireRegistrationDesc: string;
      requireMinGames: string;
      requireMinGamesDesc: string;
      formatRoundRobin: string;
      formatRoundRobinDesc: string;
      formatSingleElimination: string;
      formatSingleEliminationDesc: string;
      formatRrPlayoff: string;
      formatRrPlayoffDesc: string;
      thirdPlaceMatch: string;
      thirdPlaceMatchDesc: string;
      playoffTeams: string;
      playoffTeamsDesc: string;
      creating: string;
      createBtn: string;
      invalidTeamCount: string;
      loginRequired: string;
      loginRequiredDesc: string;
    };
    view: {
      overview: string;
      teams: string;
      matches: string;
      standings: string;
      settings: string;
      copyLink: string;
      linkCopied: string;
      yourTeam: string;
      youAreCaptain: string;
      members: string;
      rosterFull: string;
      rosterIncomplete: string;
      manageTeam: string;
      registerPrompt: string;
      createTeam: string;
      inviteTeam: string;
      generateBracket: string;
      generateMatches: string;
      createGroups: string;
      startTournament: string;
      createPlayoff: string;
      approveAllFirst: string;
      needMinTeams: string;
      matchesCreated: string;
      roundRobinComplete: string;
      btcActions: string;
      approveBeforeGroups: string;
      groupStage: string;
      roundRobin: string;
      playoffRound: string;
      seBracket: string;
      noMatches: string;
      noMatchesDesc: string;
      startConfirm: string;
      startConfirmDesc: string;
      start: string;
      teamsReady: string;
      createSchedule: string;
      deleteConfirm: string;
      deleteConfirmDesc: string;
      notFound: string;
      notFoundDesc: string;
      backToList: string;
      deleteBtn: string;
      registerForTournament: string;
      createTeamToJoin: string;
      btcActionsTitle: string;
      inviteTeamBtn: string;
      createGroupsBtn: string;
      generateBracketBtn: string;
      roundStarted: string;
      createPlayoffTitle: string;
      createPlayoffDesc: string;
      createScheduleBtn: string;
      createScheduleDesc: string;
      noMatchesEmpty: string;
      noMatchesScheduleDesc: string;
      startTournamentTitle: string;
      startTournamentDesc: string;
      startBtn: string;
      teamsReadyCount: string;
      generateScheduleBtn: string;
      seBracketTitle: string;
      groupStageTitle: string;
      roundRobinTitle: string;
      approveBeforeBracket: string;
      inviteOrCreateSchedule: string;
      inviteOrBracket: string;
      needMinTeamsForBracket: string;
      cancelBtn: string;
      deleteAction: string;
      errorOccurred: string;
      roundRobinDone: string;
      teamsReadyForSchedule: string;
      teamsReadySE: string;
      startTournamentLabel: string;
      matchesGeneratedCount: string;
      approveAllBeforeBracket: string;
      needMin6Groups: string;
      approvePendingFirst: string;
      approvePendingBracket: string;
      inviteOrSchedule: string;
    };
    roster: {
      title: string;
      countLabel: string;
      inviteCode: string;
      addMember: string;
      addFromPrevious: string;
      memberName: string;
      gender: string;
      male: string;
      female: string;
      skillLevel: string;
      optional: string;
      removeMember: string;
      removeMemberDesc: string;
      rosterFull: string;
      captain: string;
      noMembers: string;
      addedSuccess: string;
    };
    standings: {
      rank: string;
      team: string;
      played: string;
      won: string;
      lost: string;
      points: string;
      games: string;
      diff: string;
      legend: {
        played: string;
        won: string;
        lost: string;
        points: string;
        diff: string;
      };
    };
    dialog: {
      generateMatches: string;
      generateMatchesDesc: string;
      teamsCount: string;
      matchesCount: string;
      roundsCount: string;
      gamesPerMatch: string;
      minTeamsRequired: string;
      incompleteRosters: string;
      confirm: string;
    };
  };
  // Doubles Elimination
  doublesElimination: {
    title: string;
    description: string;
    createNew: string;
    loginRequired: string;
    loginRequiredDesc: string;
    noTournaments: string;
    noTournamentsDesc: string;
    viewBtn: string;
    teams: string;
    earlyRounds: string;
    semifinalPlus: string;
    status: {
      setup: string;
      ongoing: string;
      completed: string;
    };
    format: {
      bo1: string;
      bo3: string;
      bo5: string;
    };
    about: {
      title: string;
      description: string;
      round1: string;
      round2: string;
      round3: string;
      round4Plus: string;
      minTeams: string;
      suggestion: string;
    };
    setup: {
      title: string;
      tournamentName: string;
      tournamentNamePlaceholder: string;
      teamCount: string;
      minTeamsError: string;
      courtCount: string;
      startTime: string;
      earlyRoundsFormat: string;
      semifinalsFormat: string;
      finalsFormat: string;
      thirdPlaceMatch: string;
      thirdPlaceMatchDesc: string;
      creating: string;
      createBtn: string;
      shuffled: string;
      nameRequired: string;
      need32Teams: string;
      createError: string;
      addTeamsError: string;
      bracketError: string;
      createSuccess: string;
      hints: {
        byeCount: string;
        r1Matches: string;
        r2Matches: string;
      };
    };
    scoring: {
      match: string;
      court: string;
      time: string;
      vs: string;
      tbd: string;
      edit: string;
      score: string;
      waiting: string;
      winner: string;
      saveSuccess: string;
      saveError: string;
    };
    view: {
      notFound: string;
      backToList: string;
      preliminary: string;
      playoff: string;
      teams: string;
      settings: string;
      teamList: string;
      tournamentSettings: string;
      thirdPlaceMatch: string;
      courts: string;
      yes: string;
      no: string;
      share: string;
      copied: string;
      copyError: string;
      deleteConfirm: string;
      deleteConfirmDesc: string;
      deleteSuccess: string;
      deleteError: string;
      eliminatedRound: string;
      r3AssignedTitle: string;
      r3TiedDesc: string;
      r3NormalDesc: string;
    };
    bracket: {
      round: string;
      match: string;
      winnerBracket: string;
      loserBracket: string;
      finalElimination: string;
      champion: string;
      finals: string;
      thirdPlace: string;
      quarterFinal: string;
      semiFinal: string;
      round16: string;
      done: string;
      openScoring: string;
      editScore: string;
      assignR3: string;
      assigning: string;
      waitingAssignment: string;
      waitingR1R2: string;
      noMatches: string;
      noBracket: string;
      playoffNotReady: string;
      tieNotAllowed: string;
      loserOf: string;
      clickGameToEdit: string;
      waitingTeams: string;
      finalBadge: string;
      scoreSaved: string;
      matchSaved: string;
      gameSaved: string;
      scoreSaveError: string;
      playoffCreated: string;
      playoffCreatedDesc: string;
      r3Assigned: string;
      r3AssignedDesc: string;
      cancel: string;
      save: string;
      saveGameN: string;
    };
  };
  news: {
    title: string;
    subtitle: string;
    noNews: string;
    readMore: string;
  };
  seo: {
    tools: {
      title: string;
      description: string;
      formatsTitle: string;
      quickBracket: string;
      teamMatch: string;
      singleElimination: string;
      doublesElimination: string;
      flexTournament: string;
    };
    doublesElimination: {
      title: string;
      description: string;
      whenToUseTitle: string;
      whenToUseDesc: string;
      sizeTitle: string;
      sizeDesc: string;
    };
    flexTournament: {
      title: string;
      description: string;
      differenceTitle: string;
      differenceList: string[];
      whoTitle: string;
      whoDesc: string;
    };
  };
  referee: {
    title: string;
    emailPlaceholder: string;
    addBtn: string;
    emptyState: string;
    noName: string;
    removeBtn: string;
    description: string;
    loading: string;
  };
  // TeamMatch sub-component strings
  teamMatchComponents: {
    statusPending: string;
    statusApproved: string;
    statusRejected: string;
    yourTeam: string;
    youAreCaptain: string;
    members: string;
    rosterFull: string;
    rosterIncomplete: string;
    memberList: string;
    male: string;
    female: string;
    manageTeam: string;
    manageAsOrganizer: string;
    viewTeamInfo: string;
    noTeams: string;
    deleteTeamTitle: string;
    deleteTeamDesc: string;
    cancelBtn: string;
    deleteBtn: string;
    teamListTitle: string;
    registeredTeams: string;
    rosterStatus: string;
    lineupDone: string;
    // GroupMatchList
    noMatchesInGroup: string;
    noMatchesCreateSchedule: string;
    noGroupsYet: string;
    roundLabel: string;
    startRound: string;
    waitingLineup: string;
    missingLineup: string;
    scoreBtn: string;
    notStarted: string;
    liningUp: string;
    live: string;
    ended: string;
    // CreateTeamDialog
    createTeamTitle: string;
    createTeamDesc: string;
    teamNameLabel: string;
    teamNameError: string;
    captainNameLabel: string;
    captainNameError: string;
    // InviteTeamDialog
    inviteCaptainEmail: string;
    inviteCaptainEmailLabel: string;
    inviteDesc: string;
    inviteEmailError: string;
    // GroupSetupDialog
    groupSetupTitle: string;
    groupSetupDesc: string;
  };
  dashboard: {
    title: string;
    description: string;
    selectTournament: string;
    court: string;
    nowPlaying: string;
    nextMatch: string;
    available: string;
    tvMode: string;
    exitTvMode: string;
    soundOn: string;
    soundOff: string;
    noActiveTournaments: string;
    vs: string;
    match: string;
    score: string;
    quickTable: string;
    teamMatch: string;
    doublesElimination: string;
    autoRotate: string;
    liveMatches: string;
    upNext: string;
    completed: string;
    backToList: string;
  };
  forum: {
    title: string;
    navLabel: string;
    createPost: string;
    newPost: string;
    allCategories: string;
    trending: string;
    latest: string;
    pinned: string;
    qa: string;
    markAsQA: string;
    bestAnswer: string;
    markBestAnswer: string;
    unmarkBestAnswer: string;
    likes: string;
    comments: string;
    noPostsYet: string;
    noCommentsYet: string;
    writeComment: string;
    postTitle: string;
    postTitlePlaceholder: string;
    postContent: string;
    postContentPlaceholder: string;
    selectCategory: string;
    addTags: string;
    addTagsPlaceholder: string;
    attachImages: string;
    maxImages: string;
    publish: string;
    publishing: string;
    publishSuccess: string;
    deletePost: string;
    deletePostConfirm: string;
    deleteComment: string;
    loginToPost: string;
    loginToComment: string;
    by: string;
    ago: string;
    readMore: string;
    backToForum: string;
    pinPost: string;
    unpinPost: string;
    editPost: string;
    reply: string;
    replyingTo: string;
    cancelReply: string;
  };
  // Social Events MVP (Sprint 1). PR2 fills detail/register/club; PR3
  // adds create/manage/matchmaking subnamespaces.
  socialEvents: {
    nav: string;
    breadcrumb: string;
    comingSoon: string;
    detail: {
      registerCta: string;
      registerCtaShort: string;
      registerInProgress: string;
      registeredCount: string;
      spotsLeft: string;
      startsIn: string;
      startedAt: string;
      ended: string;
      cancelled: string;
      level: string;
      free: string;
      priceVnd: string;
      cancellationPolicy: string;
      cancellationPolicyBody: string;
      hostedBy: string;
      directionsLabel: string;
      zaloGroup: string;
      shareTitle: string;
      shareCopy: string;
      shareZalo: string;
      shareFacebook: string;
      copyLink: string;
      rosterHeading: string;
      rosterEmpty: string;
      privatePreview: string;
      notFound: string;
      notFoundBody: string;
    };
    register: {
      modalTitle: string;
      stepPhone: string;
      stepCode: string;
      stepPayment: string;
      stepDone: string;
      phoneLabel: string;
      phonePlaceholder: string;
      phoneInvalid: string;
      nameLabel: string;
      namePlaceholder: string;
      nameRequired: string;
      levelLabel: string;
      levelOptional: string;
      sendOtp: string;
      otpLabel: string;
      otpHint: string;
      otpHintZalo: string;
      otpHintSms: string;
      otpResend: string;
      otpResendIn: string;
      otpResendViaSms: string;
      otpInvalid: string;
      otpExpired: string;
      tooManyAttempts: string;
      tooManyOtps: string;
      alreadyRegistered: string;
      eventFull: string;
      eventNotOpen: string;
      smsFailed: string;
      networkError: string;
      submit: string;
      submitting: string;
      successTitle: string;
      successBody: string;
      successPaymentBody: string;
      orderLabel: string;
      paymentInstructions: string;
      openZalo: string;
      backToEvent: string;
      // Slot picker — only rendered when the organizer configured slots.
      slotPickerLabel: string;
      slotPickerHint: string;
      slotMetaSkill: string;
      slotMetaDurationMonths: string;
      slotMetaDurationNewbie: string;
      slotMetaCourts: string;
      slotRemainingBadge: string;
      slotFullBadge: string;
      slotRequired: string;
      slotInvalid: string;
      slotFull: string;
    };
    // Proxy + Manual registration (PR: feat/proxy-and-manual-registration)
    proxyRegister: {
      // Entry buttons
      proxyRegisterCta: string;
      manualAddCta: string;
      // Modal headings
      modalHeading: string;
      modalSubheading: string;
      manualModalHeading: string;
      manualModalSubheading: string;
      // Section headings
      guestSectionHeading: string;
      playerSectionHeading: string;
      // Form labels
      guestPhoneLabel: string;
      guestNameLabel: string;
      guestLevelLabel: string;
      guestLevelHint: string;
      paymentStatusLabel: string;
      paymentStatusUnpaid: string;
      paymentStatusClaimedPaid: string;
      paymentStatusWaived: string;
      internalNotesLabel: string;
      internalNotesHint: string;
      internalNotesPlaceholder: string;
      // CTAs
      proxyConfirmCta: string;
      manualConfirmCta: string;
      // Warning
      paymentWarningProxy: string;
      // Skip warning on prepayment-required events (proxy success)
      prepaymentSkipWarning: string;
      // Success share
      successHeading: string;          // "Đã thêm {name} vào sự kiện"
      shareWarning: string;            // "Vui lòng gửi link sau cho {name}…"
      shareLinkHeading: string;        // "Link quản lý đăng ký của {name}"
      copyLinkLabel: string;
      copyLinkSuccess: string;
      shareZaloLabel: string;
      shareFacebookLabel: string;
      copyPaymentInfoLabel: string;
      copyPaymentInfoSuccess: string;
      addAnotherCta: string;
      closeCta: string;
      // Errors
      errorAlreadyRegistered: string;
      errorEventFull: string;
      errorRateLimitProxy: string;
      errorRateLimitManual: string;
      errorUnauthorized: string;
      // Roster badges (PR adds badges next to names for proxy/manual rows)
      proxyBadgeLabel: string;
      manualBadgeLabel: string;
    };
    club: {
      upcomingHeading: string;
      pastHeading: string;
      noUpcoming: string;
      eventsLabel: string;
      notFound: string;
      notFoundBody: string;
      manageEventCta: string;
      archivedHeading: string;
      archivedBody: string;
    };
    // PR3 — organizer surfaces
    create: {
      pageTitle: string;
      pageSubtitle: string;
      titleVi: string;
      titleEn: string;
      titleViPlaceholder: string;
      titleEnPlaceholder: string;
      slug: string;
      slugHint: string;
      slugAuto: string;
      descriptionVi: string;
      descriptionEn: string;
      startAt: string;
      endAt: string;
      location: string;
      locationPlaceholder: string;
      latLng: string;
      courtCount: string;
      maxPlayers: string;
      levelMin: string;
      levelMax: string;
      priceVnd: string;
      priceVndHint: string;
      allowGuests: string;
      allowGuestsHint: string;
      cancellationHours: string;
      zaloGroupUrl: string;
      visibility: string;
      visibilityPublic: string;
      visibilityClubOnly: string;
      saveDraft: string;
      publishNow: string;
      submitting: string;
      errorRequired: string;
      errorTimeOrder: string;
      errorSlugTaken: string;
      errorSlugFormat: string;
      successDraft: string;
      successPublished: string;
      // ── PR50a wizard additions ────────────────────────────────────
      stepIndicator: string;
      step1Heading: string;
      step1Subheading: string;
      step2Heading: string;
      nextButton: string;
      backButton: string;
      eventName: string;
      eventNamePlaceholder: string;
      description: string;
      startDate: string;
      startTime: string;
      endTime: string;
      priceAmount: string;
      priceFreeHint: string;
      paymentBannerFree: string;
      paymentBannerNotConfigured: string;
      paymentBannerNotConfiguredCta: string;
      paymentBannerReady: string;
      errorTitleMin: string;
      errorTitleMax: string;
      errorLocationMin: string;
      errorPastDate: string;
      errorMaxPlayersMin: string;
      errorCourtCountMin: string;
      errorZaloUrl: string;
      errorPriceTooLarge: string;
      errorPriceNeg: string;
      // ── PR51 bank fields on the Step-2 form ───────────────────────
      step2PaymentHeading: string;
      bankInfoHeading: string;
      bankLabel: string;
      bankPlaceholder: string;
      accountNumberLabel: string;
      accountNumberPlaceholder: string;
      accountNameLabel: string;
      accountNameHint: string;
      bankDisclaimer: string;
      previewLabel: string;
      previewAlt: string;
      errorAccountNumber: string;
      errorAccountName: string;
      // PR67 — prepayment toggle + deadline
      requirePrepayment: string;
      requirePrepaymentDescription: string;
      paymentDeadlineHours: string;
      paymentDeadlineHint: string;
      errorPrepaymentDeadlineRange: string;
      // Weekly-repeat
      repeatWeeksLabel: string;
      repeatWeeksUnit: string;
      repeatWeeksHint: string;
      repeatWeeksPreview: string;
      errorRepeatWeeksRange: string;
      bulkCreatedToast: string;
      // Slots — registration sub-buckets (skill / duration / general).
      slotsHeading: string;
      slotsSubheading: string;
      slotsEmptyHint: string;
      slotsTotalCapacity: string;
      slotAddSkill: string;
      slotAddDuration: string;
      slotAddGeneral: string;
      slotKindSkill: string;
      slotKindDuration: string;
      slotKindGeneral: string;
      slotLabel: string;
      slotLabelPlaceholderSkill: string;
      slotLabelPlaceholderDuration: string;
      slotLabelPlaceholderGeneral: string;
      slotCapacity: string;
      slotSkillLevel: string;
      slotSkillChoose: string;
      slotSkillNewbie: string;
      slotCourtCount: string;
      slotMinPlayMonths: string;
      slotDurationChoose: string;
      slotDurationLT3: string;
      slotDuration3: string;
      slotDuration6: string;
      slotDuration12: string;
      slotDuration24: string;
      slotDuration36: string;
      slotNotes: string;
      slotNotesPlaceholder: string;
      slotRemoveAria: string;
      errorSlotLabelMin: string;
      errorSlotLabelMax: string;
      errorSlotCapacityMin: string;
      errorSlotCapacityMax: string;
      errorSlotSkillRequired: string;
      errorSlotDurationRange: string;
      errorSlotsExceedMaxPlayers: string;
      errorSlotTooMany: string;
      errorSlotDuplicateId: string;
    };
    manage: {
      pageTitle: string;
      newEventCta: string;
      backToClub: string;
      noEvents: string;
      emptyHeading: string;
      emptyBody: string;
      emptyCta: string;
      statsRegistered: string;
      statsPaid: string;
      statsCheckedIn: string;
      statusDraft: string;
      statusPublished: string;
      statusCancelled: string;
      statusCompleted: string;
      manageRoster: string;
      shufflePairs: string;
      editEvent: string;
      viewPublic: string;
      cancelEvent: string;
      cancelEventConfirm: string;
      cancelEventConfirmBody: string;
      cancelled: string;
      reopen: string;
      reopenedToast: string;
      noPermissionTitle: string;
      noPermissionBody: string;
    };
    clubsList: {
      pageTitle: string;
      kicker: string;
      heading: string;
      subheading: string;
      searchPlaceholder: string;
      searchAria: string;
      createCta: string;
      createCtaAnon: string;
      emptyAll: string;
      emptySearch: string;
      cardCta: string;
      cardEventCount: string;
      cardNoEvents: string;
      cardCreatedBy: string;
      sectionMine: string;
      sectionAll: string;
    };
    createClub: {
      pageTitle: string;
      kicker: string;
      heading: string;
      nameLabel: string;
      namePlaceholder: string;
      nameInvalid: string;
      slugLabel: string;
      slugAuto: string;
      slugHint: string;
      slugInvalid: string;
      slugChecking: string;
      slugTaken: string;
      slugAvailable: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      locationLabel: string;
      locationPlaceholder: string;
      locationHint: string;
      logoLabel: string;
      logoUpload: string;
      logoRemove: string;
      logoHint: string;
      logoUploadError: string;
      logoTooLargeTitle: string;
      logoTooLargeBody: string;
      submit: string;
      submitting: string;
      infoBanner: string;
      tooManyClubsTitle: string;
      tooManyClubsBody: string;
      successTitle: string;
      successBody: string;
      backToList: string;
    };
    entityNotFound: {
      club: { title: string; body: string; backCta: string };
      event: { title: string; body: string; backCta: string };
      profile: { title: string; body: string; backCta: string };
    };
    recovery: {
      pageTitle: string;
      eyebrow: string;
      heading: string;
      subheading: string;
      phoneLabel: string;
      phoneInvalid: string;
      submit: string;
      submitting: string;
      zaloSentTitle: string;
      zaloSentBody: string;
      emailSentTitle: string;
      emailSentBody: string;
      captchaTitle: string;
      captchaBody: string;
      captchaSubmit: string;
      captchaVerifying: string;
      captchaSuccessTitle: string;
      captchaSuccessBody: string;
      captchaOpenCta: string;
      noRegistration: string;
      noRegistrationCta: string;
      lostLinkHint: string;
      lostLinkCta: string;
      errors: {
        generic: string;
        invalid_phone: string;
        no_registration_found: string;
        rate_limit_exceeded: string;
        captcha_failed: string;
        captcha_required: string;
      };
    };
    recoveryOptIn: {
      heading: string;
      body: string;
      emailLabel: string;
      saveCta: string;
      skipCta: string;
      saveSuccess: string;
      saveError: string;
      zaloHint: string;
    };
    playerRegistration: {
      pageTitle: string;
      eyebrow: string;
      viewPublic: string;
      statusActive: string;
      statusCancelled: string;
      labelName: string;
      labelWhen: string;
      labelWhere: string;
      labelPrice: string;
      labelCancelledAt: string;
      labelCancelledReason: string;
      priceFree: string;
      paymentHeading: string;
      paymentMarked: string;
      paymentPending: string;
      cancellationPolicyHeading: string;
      refundEligible: string;
      refundIneligible: string;
      refundManualNote: string;
      cancelCta: string;
      cancelModalTitle: string;
      cancelModalBody: string;
      cancelReasonLabel: string;
      cancelReasonPlaceholder: string;
      cancelConfirmCta: string;
      cancelling: string;
      modalBack: string;
      cancelSuccessTitle: string;
      cancelSuccessBody: string;
      reactivateCta: string;
      reactivating: string;
      reactivateSuccessTitle: string;
      reactivateSuccessBody: string;
      eventStartedHint: string;
      eventFullHint: string;
      eventCancelledTitle: string;
      eventCancelledBody: string;
      referenceCodeCopied: string;
      notFoundTitle: string;
      notFoundBody: string;
      saveLinkHeading: string;
      saveLinkBody: string;
      saveLinkCopy: string;
      saveLinkCopied: string;
      saveLinkOpen: string;
      saveLinkScreenshotHint: string;
      alreadyRegisteredBanner: string;
      alreadyRegisteredCta: string;
      cancelledBanner: string;
      reregisterCta: string;
      // PR67 — prepayment countdown banner
      unpaidRegistrationBannerTitle: string;
      unpaidRegistrationBannerDescription: string;
      timeRemaining: string;
      paymentOverdue: string;
      payNowButton: string;
      payNowConfirmPrompt: string;
      payNowConfirm: string;
      payNowCancel: string;
      payNowSuccess: string;
      errors: {
        generic: string;
        invalid_magic_token: string;
        not_found: string;
        registration_missing: string;
        event_missing: string;
        event_started: string;
        event_cancelled: string;
        event_completed: string;
        event_not_open: string;
        event_full: string;
        already_cancelled: string;
        update_failed: string;
        lookup_failed: string;
      };
    };
    editEvent: {
      pageTitle: string;
      eyebrow: string;
      slugLabel: string;
      slugImmutableHint: string;
      titleLabel: string;
      descriptionLabel: string;
      dateLabel: string;
      startTimeLabel: string;
      endTimeLabel: string;
      locationLabel: string;
      courtCountLabel: string;
      maxPlayersLabel: string;
      maxPlayersFloor: string;
      errorMaxPlayersBelowReg: string;
      zaloLabel: string;
      visibilityLabel: string;
      visibilityPublic: string;
      visibilityClubOnly: string;
      paymentHeading: string;
      priceLabel: string;
      priceLockedByClaims: string;
      bankWarning: string;
      bankCodeLabel: string;
      bankAccountNumberLabel: string;
      bankAccountNameLabel: string;
      save: string;
      saving: string;
      cancelBtn: string;
      savedTitle: string;
      savedBody: string;
      savedPartialTitle: string;
      savedPartialBody: string;
      activeRegsWarning: string;
      readOnlyStartedTitle: string;
      readOnlyStartedBody: string;
      readOnlyCancelledTitle: string;
      readOnlyCancelledBody: string;
      dangerZone: string;
      cancelEventHeading: string;
      cancelEventBody: string;
      cancelEventCta: string;
      cancelEventModalTitle: string;
      cancelEventModalBody: string;
      cancelEventModalInputLabel: string;
      cancelEventConfirmCta: string;
      cancelEventCancelling: string;
      cancelEventSuccessTitle: string;
      cancelEventSuccessBody: string;
      modalBack: string;
    };
    editClub: {
      pageTitle: string;
      slugLabel: string;
      slugImmutableHint: string;
      nameLabel: string;
      descriptionLabel: string;
      locationLabel: string;
      logoLabel: string;
      save: string;
      saving: string;
      cancel: string;
      successTitle: string;
      successBody: string;
      dangerZone: string;
      archiveHeading: string;
      archiveBody: string;
      archiveCta: string;
      archiveModalTitle: string;
      archiveModalBody: string;
      archiveModalInputLabel: string;
      archiveConfirmCta: string;
      archiving: string;
      archiveSuccessTitle: string;
      archiveSuccessBody: string;
    };
    managers: {
      heading: string;
      subheading: string;
      creatorBadge: string;
      managerBadge: string;
      addCta: string;
      searchLabel: string;
      searchPlaceholder: string;
      searchButton: string;
      searching: string;
      searchEmpty: string;
      searchInvalid: string;
      addConfirm: string;
      addSuccess: string;
      addError: string;
      removeAria: string;
      removeConfirm: string;
      removeSuccess: string;
      removeError: string;
      addedBy: string;
      empty: string;
      ownerOnly: string;
      errAlreadyManager: string;
      errAlreadyCreator: string;
      errProfileNotFound: string;
      errNotAuthorized: string;
    };
    roster: {
      pageTitle: string;
      registeredCount: string;
      paidCount: string;
      claimedCount: string;
      noRegistrations: string;
      addManual: string;
      addManualTitle: string;
      addManualSubmit: string;
      export: string;
      colName: string;
      colPhone: string;
      colLevel: string;
      colStatus: string;
      colPayment: string;
      colReferenceCode: string;
      colTransferStatus: string;
      colRegistered: string;
      colActions: string;
      transferClaimed: string;
      transferNotClaimed: string;
      reconcileBanner: string;
      viewProfileHint: string;
      actionCheckIn: string;
      actionUndoCheckIn: string;
      actionMarkPaid: string;
      actionMarkUnpaid: string;
      actionMarkNoShow: string;
      actionCancel: string;
      actionEditNotes: string;
      confirmCancelTitle: string;
      confirmCancelBody: string;
      confirmNoShowTitle: string;
      confirmNoShowBody: string;
      notesPlaceholder: string;
      saveNotes: string;
      updatedToast: string;
      deletedToast: string;
    };
    matchmaking: {
      pageTitle: string;
      tabMexicano: string;
      tabRoundRobin: string;
      selectPlayersTitle: string;
      selectAll: string;
      selectNone: string;
      selectedCount: string;
      roundsLabel: string;
      courtsLabel: string;
      generate: string;
      regenerate: string;
      oddPlayersWarning: string;
      schedule: string;
      round: string;
      court: string;
      teamA: string;
      teamB: string;
      sittingOut: string;
      print: string;
      copy: string;
      copied: string;
      empty: string;
      notEnoughPlayers: string;
      saveToEvent: string;
      savingToEvent: string;
      savedToEventToast: string;
      saveOverwriteConfirmTitle: string;
      saveOverwriteConfirmBody: string;
      openLivePage: string;
      savedScheduleBanner: string;
      regenerateHint: string;
    };
    live: {
      pageTitle: string;
      pageTitleSpectator: string;
      noScheduleTitle: string;
      noScheduleBody: string;
      notRegisteredTitle: string;
      notRegisteredBody: string;
      zoneNow: string;
      zoneNoNow: string;
      zoneNowOrganizerSubtitle: string;
      zoneNowOrganizerEmpty: string;
      zoneRestingTitle: string;
      zoneRestingBody: string;
      zoneRestingNoNext: string;
      zoneNext: string;
      zoneNoNext: string;
      zoneNextHint: string;
      zoneStandings: string;
      zoneStandingsEmpty: string;
      zoneScoreInput: string;
      zoneZalo: string;
      openZalo: string;
      startMatch: string;
      startMatchHint: string;
      starting: string;
      court: string;
      round: string;
      teamA: string;
      teamB: string;
      versus: string;
      submitScore: string;
      submitting: string;
      awaitingOpponent: string;
      bothConfirmed: string;
      statusScheduled: string;
      statusInProgress: string;
      statusCompleted: string;
      organizerOverride: string;
      organizerOverrideHint: string;
      colRank: string;
      colPlayer: string;
      colWins: string;
      colLosses: string;
      colDiff: string;
      youLabel: string;
      scoreToast: string;
      scoreCompletedToast: string;
      scoreErrorToast: string;
      notInMatchToast: string;
      organizerCta: string;
      backToEvent: string;
    };
    payment: {
      amountLabel: string;
      qrAlt: string;
      bankLabel: string;
      accountNumberLabel: string;
      accountNameLabel: string;
      memoLabel: string;
      referenceCodeLabel: string;
      warning: string;
      claimButton: string;
      skipButton: string;
      submitting: string;
      claimedTitle: string;
      claimedBody: string;
      claimedHint: string;
      claimedToast: string;
      claimError: string;
      copiedToast: string;
      // PR67 — prepayment warning + "pay later" button + unpaid badge
      prepaymentWarningTitle: string;
      prepaymentWarningDescription: string;
      payLater: string;
      unpaidStatusBadge: string;
    };
    profile: {
      notFoundTitle: string;
      notFoundBody: string;
      levelLabel: string;
      eventsPlayedShort: string;
      matchesPlayedShort: string;
      ghostHint: string;
      stats: {
        eventsLabel: string;
        matchesLabel: string;
        winsLabel: string;
        streakLabel: string;
      };
      badgesHeading: string;
      historyHeading: string;
      lockedHint: string;
      earnedOn: string;
      history: {
        empty: string;
        partner: string;
        vs: string;
        loadMore: string;
        loading: string;
      };
      badges: {
        first_event: { title: string; description: string };
        first_match: { title: string; description: string };
        first_win: { title: string; description: string };
        event_5: { title: string; description: string };
        event_10: { title: string; description: string };
        event_25: { title: string; description: string };
        event_50: { title: string; description: string };
        match_10: { title: string; description: string };
        match_50: { title: string; description: string };
        match_100: { title: string; description: string };
        win_streak_3: { title: string; description: string };
        win_streak_5: { title: string; description: string };
        night_owl: { title: string; description: string };
      };
    };
  };
  // Sonner toast strings consumed by mutation hooks via tStandalone()
  // (hooks live outside React render tree, can't use useI18n()).
  toast: {
    common: {
      authRequired: string;
      unknownError: string;
    };
    registration: {
      submit: {
        authRequired: string;
        displayNameRequired: string;
        duplicate: string;
        success: string;
        error: string;
      };
      update: {
        success: string;
        error: string;
      };
      cancel: {
        success: string;
        error: string;
      };
      approve: {
        success: string;
        error: string;
      };
      reject: {
        success: string;
        error: string;
      };
      bulkApprove: {
        success: string;
        error: string;
      };
      btcOverride: {
        success: string;
        error: string;
      };
    };
    teamRegistration: {
      createTeam: {
        authRequired: string;
        duplicate: string;
        displayNameRequired: string;
        success: string;
        error: string;
      };
      createInvitation: {
        maxReached: string;
        success: string;
        error: string;
      };
      cancelInvitation: {
        success: string;
        error: string;
      };
      acceptInvitation: {
        success: string;
        error: string;
        codes: {
          INVITATION_NOT_FOUND: string;
          INVITATION_ALREADY_USED: string;
          INVITATION_EXPIRED: string;
          TEAM_NOT_FOUND: string;
          TEAM_ALREADY_COMPLETE: string;
          TABLE_LOCKED: string;
          CANNOT_JOIN_OWN_TEAM: string;
        };
      };
      removePartner: {
        success: string;
        error: string;
        codes: {
          TEAM_NOT_FOUND: string;
          PERMISSION_DENIED: string;
          TABLE_LOCKED: string;
        };
      };
      btcManage: {
        approved: string;
        rejected: string;
        removed: string;
        error: string;
        codes: {
          TEAM_NOT_FOUND: string;
          PERMISSION_DENIED: string;
          INVALID_ACTION: string;
        };
      };
    };
    pairRequest: {
      create: {
        success: string;
        error: string;
        codes: {
          AUTH_REQUIRED: string;
          TABLE_NOT_FOUND: string;
          TABLE_LOCKED: string;
          NO_TEAM: string;
          TEAM_REJECTED: string;
          ALREADY_HAS_PARTNER: string;
          TARGET_TEAM_NOT_FOUND: string;
          TARGET_TEAM_REJECTED: string;
          TARGET_HAS_PARTNER: string;
          SAME_TEAM: string;
          REQUEST_ALREADY_SENT: string;
          REQUEST_PENDING_FROM_TARGET: string;
        };
      };
      respond: {
        acceptSuccess: string;
        rejectSuccess: string;
        error: string;
        codes: {
          AUTH_REQUIRED: string;
          REQUEST_NOT_FOUND: string;
          NOT_TARGET_USER: string;
          REQUEST_NOT_PENDING: string;
          TABLE_LOCKED: string;
          FROM_TEAM_ALREADY_PAIRED: string;
          TO_TEAM_ALREADY_PAIRED: string;
        };
      };
      cancel: {
        success: string;
        error: string;
      };
    };
    parentTournament: {
      create: {
        nameRequired: string;
        error: string;
        permissionDenied: string;
      };
      delete: {
        hasChildren: string;
        success: string;
        error: string;
        permissionDenied: string;
      };
    };
  };
}

// Vietnamese translations
export const vi: Translations = {
  common: {
    appName: "The PickleHub",
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
    close: "Đóng",
    loadMore: "Xem thêm",
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
  terms: {
    title: "Điều khoản Sử dụng – The Pickle Hub",
    intro: {
      title: "Giới thiệu",
      description: "Chào mừng bạn đến với The Pickle Hub. Bằng việc sử dụng dịch vụ của chúng tôi, bạn đồng ý tuân thủ các điều khoản sau đây.",
      acceptance: "Nếu bạn không đồng ý với bất kỳ điều khoản nào, vui lòng không sử dụng dịch vụ.",
    },
    account: {
      title: "Điều khoản Tài khoản",
      items: {
        age: "Bạn phải đủ 13 tuổi để sử dụng dịch vụ",
        accuracy: "Thông tin đăng ký phải chính xác và trung thực",
        security: "Bạn chịu trách nhiệm bảo mật tài khoản của mình",
        responsibility: "Bạn chịu trách nhiệm về mọi hoạt động trong tài khoản",
      },
    },
    acceptableUse: {
      title: "Sử dụng Hợp lệ",
      description: "Khi sử dụng The Pickle Hub, bạn cam kết:",
      items: {
        noIllegal: "Không thực hiện hành vi bất hợp pháp",
        noHarassment: "Không quấy rối, đe dọa hoặc xúc phạm người khác",
        noSpam: "Không spam hoặc gửi nội dung rác",
        noImpersonation: "Không mạo danh người khác hoặc tổ chức",
        noMalware: "Không phát tán mã độc hoặc phần mềm có hại",
      },
    },
    userContent: {
      title: "Nội dung Người dùng",
      description: "Về nội dung bạn đăng tải:",
      items: {
        ownership: "Bạn giữ quyền sở hữu nội dung do bạn tạo ra",
        license: "Bạn cấp cho chúng tôi quyền hiển thị nội dung trên nền tảng",
        moderation: "Chúng tôi có quyền xóa nội dung vi phạm quy định",
      },
    },
    intellectualProperty: {
      title: "Sở hữu Trí tuệ",
      description: "Thương hiệu, logo và nội dung của The Pickle Hub được bảo vệ bởi luật sở hữu trí tuệ. Bạn không được sao chép hoặc sử dụng mà không có sự cho phép.",
    },
    liability: {
      title: "Giới hạn Trách nhiệm",
      description: "The Pickle Hub cung cấp dịch vụ với các giới hạn sau:",
      items: {
        asIs: "Dịch vụ được cung cấp \"nguyên trạng\"",
        noWarranty: "Không đảm bảo dịch vụ hoạt động liên tục hoặc không có lỗi",
        limitation: "Chúng tôi không chịu trách nhiệm về thiệt hại gián tiếp",
      },
    },
    termination: {
      title: "Chấm dứt Dịch vụ",
      description: "Về việc chấm dứt sử dụng dịch vụ:",
      items: {
        userRight: "Bạn có thể xóa tài khoản bất kỳ lúc nào",
        platformRight: "Chúng tôi có thể đình chỉ tài khoản vi phạm điều khoản",
        effect: "Sau khi chấm dứt, dữ liệu của bạn sẽ được xóa theo chính sách bảo mật",
      },
    },
    changes: {
      title: "Thay đổi Điều khoản",
      description: "Chúng tôi có thể cập nhật điều khoản này. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi đồng nghĩa với việc bạn chấp nhận điều khoản mới.",
    },
    contact: {
      title: "Liên hệ",
      description: "Nếu bạn có câu hỏi về điều khoản sử dụng, vui lòng liên hệ:",
    },
    effective: {
      text: "Điều khoản này có hiệu lực từ ngày {date}.",
      update: "Điều khoản có thể được cập nhật khi nền tảng phát triển.",
    },
  },
  report: {
    report: "Báo cáo",
    title: "Báo cáo vi phạm",
    description: "Vui lòng cho chúng tôi biết lý do bạn muốn báo cáo nội dung này.",
    submit: "Gửi báo cáo",
    success: "Đã gửi báo cáo. Chúng tôi sẽ xem xét sớm nhất.",
    error: "Không thể gửi báo cáo. Vui lòng thử lại.",
    alreadyReported: "Bạn đã báo cáo nội dung này rồi.",
    additionalInfo: "Thông tin bổ sung...",
  },
  account: {
    changePassword: "Đổi mật khẩu",
    changePasswordDescription: "Nhập mật khẩu mới để cập nhật tài khoản.",
    currentPassword: "Mật khẩu hiện tại",
    newPassword: "Mật khẩu mới",
    confirmNewPassword: "Xác nhận mật khẩu mới",
    passwordChanged: "Đổi mật khẩu thành công",
    passwordChangeError: "Không thể đổi mật khẩu. Vui lòng thử lại.",
    passwordMismatch: "Mật khẩu xác nhận không khớp",
    passwordTooShort: "Mật khẩu phải có ít nhất 6 ký tự",
    deleteAccount: "Xóa tài khoản",
    deleteAccountTitle: "Xóa tài khoản vĩnh viễn",
    deleteAccountWarning: "Hành động này sẽ xóa vĩnh viễn tài khoản và tất cả dữ liệu của bạn, bao gồm:",
    deleteDataProfile: "Thông tin hồ sơ và ảnh đại diện",
    deleteDataTournaments: "Các giải đấu bạn đã tạo",
    deleteDataContent: "Bình luận, lượt thích và dữ liệu tương tác",
    deleteAccountIrreversible: "Hành động này không thể hoàn tác.",
    deleteConfirmInstruction: "Nhập \"{word}\" để xác nhận:",
    deleteAccountConfirm: "Xóa tài khoản",
  },
  nav: {
    home: "Trang chủ",
    live: "Trực tiếp",
    videos: "Video",
    tournaments: "Giải đấu",
    tools: "Công cụ",
    feed: "Bảng tin",
    social: "Đi đánh",
    search: "Tìm kiếm",
    profile: "Tài khoản",
    viewProfile: "Xem hồ sơ",
    login: "Đăng nhập",
    logout: "Đăng xuất",
    signup: "Đăng ký",
    creator: "Creator Studio",
    admin: "Quản trị",
    openMenu: "Mở menu",
    closeMenu: "Đóng menu",
  },
  tools: {
    title: "Phần mềm Tổ chức Giải Pickleball & Tạo Bracket Miễn Phí",
    description: "Phần mềm tổ chức giải pickleball miễn phí. Tạo bracket, vòng tròn, MLP team match & loại kép. Chấm điểm realtime, tối ưu di động.",
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
    flexTournament: {
      title: "Flex Tournament",
      description: "Tạo giải đấu theo cách của bạn. Hoàn toàn linh hoạt. Không giới hạn luật.",
      subtitle: "Tạo giải đấu theo cách của bạn. Hoàn toàn linh hoạt. Không giới hạn luật.",
      subtitleFull: "Đây là thể thức do người dùng tự tạo, linh hoạt và không giới hạn luật thi đấu. Người tạo giải toàn quyền sắp xếp VĐV, đội, bảng và trận đấu theo nhu cầu thống kê của mình.",
      create: "Tạo giải đấu",
      tournamentName: "Tên giải đấu",
      tournamentNamePlaceholder: "Nhập tên giải đấu",
      addPlayers: "Thêm VĐV",
      addPlayersPlaceholder: "Nhập tên VĐV (mỗi dòng một tên)",
      addPlayersHint: "Bạn có thể paste nhiều tên cùng lúc",
      playerPool: "Danh sách VĐV",
      addTeam: "+ Đội",
      addGroup: "+ Bảng",
      addMatch: "+ Trận",
      teamName: "Tên đội",
      groupName: "Tên bảng",
      matchName: "Tên trận",
      matchType: {
        label: "Loại trận",
        singles: "Đơn",
        doubles: "Đôi",
      },
      stats: {
        playerStats: "Thống kê VĐV",
        pairStats: "Thống kê cặp đôi",
        wins: "T",
        losses: "B",
        pointDiff: "+/-",
        rank: "#",
        name: "Tên",
        pair: "Cặp",
      },
      generateRR: "Tạo lịch vòng tròn",
      unlisted: "Không công khai",
      public: "Công khai",
      slotA: "Bên A",
      slotB: "Bên B",
      noPlayers: "Chưa có VĐV",
      noTeams: "Chưa có đội",
      noGroups: "Chưa có bảng",
      noMatches: "Chưa có trận",
      dropPlayerHere: "Kéo VĐV hoặc đội vào đây",
      dropTeamHere: "Kéo đội vào đây",
      score: "Điểm",
      vs: "vs",
      deleteConfirm: "Bạn có chắc muốn xóa?",
      myTournaments: "Giải đấu của tôi",
      createNew: "Tạo mới",
      noTournaments: "Chưa có giải đấu. Hãy tạo giải đầu tiên!",
      viewTournament: "Xem",
      share: "Chia sẻ",
      settings: "Cài đặt",
      visibility: "Hiển thị",
      visibilityHint: "Giải công khai có thể xem bởi bất kỳ ai có link",
      deleteError: "Không thể xóa",
      createError: "Không thể tạo giải đấu",
      createSuccess: "Đã tạo giải đấu!",
      updateSuccess: "Đã cập nhật",
      generating: "Đang tạo...",
      rrGenerated: "Đã tạo lịch vòng tròn",
      duplicatePlayer: "Tên VĐV này đã tồn tại",
      duplicateInTeam: "VĐV này đã có trong đội này",
      duplicateInGroup: "VĐV/Đội này đã có trong bảng này",
      groupTypeMismatch: "Bảng chỉ nhận VĐV hoặc chỉ nhận đội",
      duplicateInMatch: "VĐV này đã có trong trận này",
      includeDoublesInSingles: "Tính cả các trận đôi",
      noDoublesStats: "Chưa có thống kê đôi",
      countsForStandings: "Tính vào bảng xếp hạng",
      noGroupHint: "Tạo bảng đấu để xem thống kê",
      playerPanel: "Danh sách VĐV",
      openPlayerPanel: "Mở danh sách VĐV",
      teams: "Đội",
      wins: "thắng",
      tabTeams: "Đội",
      tabGroups: "Bảng",
      tabMatches: "Trận đấu",
      groupTabTeams: "Đội",
      groupTabIndividuals: "Cá nhân",
      selectTeamsToShow: "Chọn đội để hiển thị thành tích cá nhân",
      allTeams: "Tất cả",
      noPairStats: "Chưa có thống kê cặp đôi",
      childMatch: "Trận",
      addChildMatch: "+ Trận cá nhân",
      selectPlayer: "Chọn VĐV",
      childMatches: "Trận cá nhân",
      assignToGroup: "Thuộc bảng",
      noGroup: "Không thuộc bảng nào",
      selectGroup: "Chọn bảng",
    },
  },
  auth: {
    login: "Đăng nhập",
    signup: "Đăng ký tài khoản",
    email: "Email",
    password: "Mật khẩu",
    confirmPassword: "Xác nhận mật khẩu",
    forgotPassword: "Quên mật khẩu?",
    forgotPasswordDesc: "Nhập email của bạn để nhận liên kết đặt lại mật khẩu.",
    resetPassword: "Đặt lại mật khẩu",
    resetPasswordSent: "Đã gửi email đặt lại mật khẩu",
    resetPasswordSentDesc: "Vui lòng kiểm tra hộp thư đến (và thư rác) để đặt lại mật khẩu.",
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
    tagline: "Pickleball, một tài khoản — mọi giải.",
    continueWithApple: "Đăng nhập với Apple",
    dividerWithEmail: "HOẶC TIẾP TỤC VỚI EMAIL",
    privacyPolicy: "CHÍNH SÁCH BẢO MẬT",
    passwordMinError: "Mật khẩu cần ít nhất 8 ký tự",
  },
  moderation: {
    block: "Chặn",
    unblock: "Bỏ chặn",
    blocked: "Đã chặn người dùng",
    unblocked: "Đã bỏ chặn người dùng",
    blockedDesc: "Bạn đã chặn {name}. Bạn sẽ không thấy nội dung của họ.",
    unblockedDesc: "Bạn đã bỏ chặn {name}.",
    blockConfirm: "Bạn có chắc muốn chặn người dùng này? Bạn sẽ không thấy nội dung của họ nữa.",
    unblockConfirm: "Bạn có chắc muốn bỏ chặn người dùng này?",
  },
  home: {
    hero: {
      title: "The Pickle Hub",
      subtitle: "Nền tảng media chuyên nghiệp về Pickleball",
      description: "Livestream trực tiếp và video theo yêu cầu từ các giải đấu hàng đầu",
      cta: "Khám phá giải đấu",
      badge: "PPA TOUR ASIA 2026",
      mainTitle: "Pickleball Đang Bùng Nổ Tại Châu Á",
      mainDescription: "Tổ chức giải song ngữ, xem livestream các trận đấu và theo dõi tin tức pickleball — nền tảng duy nhất xây cho châu Á.",
    },
    sections: {
      liveNow: "Đang phát trực tiếp",
      latestVideos: "Video mới nhất",
      trendingVideos: "Video Trending",
      popularThisWeek: "Phổ biến tuần này",
      tournaments: "Giải đấu",
      organizations: "Tổ chức",
      upcomingTournaments: "Giải Đấu Sắp Diễn Ra",
      upcomingSubtitle: "Đăng ký ngay trước khi hết chỗ",
    },
    noLive: "Hiện không có livestream nào",
    noVideos: "Chưa có video nào",
    // SEO Feature blocks
    features: {
      livestreamTitle: "Livestream Pickleball",
      livestreamDesc: "Xem trực tiếp các giải đấu pickleball chuyên nghiệp và nghiệp dư. Theo dõi các trận đấu hấp dẫn với bình luận trực tiếp từ mọi nơi.",
      tournamentsTitle: "Giải đấu & Bracket",
      tournamentsDesc: "Công cụ chia bảng thông minh, tự động tạo lịch thi đấu round-robin hoặc playoff. Quản lý giải đấu dễ dàng với giao diện thân thiện.",
      communityTitle: "Cộng đồng Pickleball",
      communityDesc: "Kết nối với hàng nghìn người chơi pickleball trên khắp thế giới. Đăng ký tham gia giải đấu, theo dõi creator yêu thích và chia sẻ đam mê.",
    },
    // SEO Footer
    about: {
      title: "Về ThePickleHub",
      description: "ThePickleHub là nền tảng pickleball toàn diện dành cho người chơi và ban tổ chức giải đấu toàn cầu. Chúng tôi cung cấp livestream trực tiếp các giải đấu pickleball, công cụ quản lý giải đấu với bracket tự động, và không gian để người chơi kết nối với nhau. Dù bạn là người mới bắt đầu hay đã có kinh nghiệm, ThePickleHub là nơi để bạn theo dõi, học hỏi và phát triển kỹ năng pickleball.",
      watchLive: "Xem Livestream →",
      tournaments: "Các Giải Đấu →",
      freeTools: "Công Cụ Miễn Phí →",
    },
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
    totalViews: "lượt xem",
    endedAt: "Kết thúc lúc",
    scheduled: "Đã lên lịch",
    ended: "Đã kết thúc",
    startingSoon: "Sắp bắt đầu",
    watchLive: "Xem trực tiếp",
    noLivestreams: "Không có livestream nào",
    scheduledFor: "Bắt đầu lúc",
    replay: "Xem lại",
    watchingTooltip: "Số người đang xem trực tiếp ngay bây giờ",
    totalViewsTooltip: "Tổng số lượt xem từ khi bắt đầu phát",
    previewRemaining: "Còn {seconds}s xem thử",
    previewEnded: "Hết thời gian xem thử",
    signupToWatch: "Đăng ký miễn phí để tiếp tục xem",
    loginToWatch: "Đăng nhập để xem",
    createAccount: "Tạo tài khoản miễn phí",
    // SEO Hub content
    hubTitle: "Xem Livestream Pickleball",
    hubDescription: "Xem trực tiếp các giải pickleball trên ThePickleHub – điểm đến cho những ai yêu thích pickleball.",
    seo: {
      tournamentsTitle: "Xem Trực Tiếp Các Giải Pickleball",
      tournamentsDesc: "ThePickleHub mang đến trải nghiệm xem livestream pickleball tốt nhất. Theo dõi các trận đấu trực tiếp từ giải chuyên nghiệp, giải phong trào đến các sự kiện cộng đồng. Nền tảng có sự góp mặt của các creator hàng đầu với chất lượng phát sóng cao, bao gồm đơn nam, đơn nữ, đôi nam, đôi nữ và đôi nam nữ.",
      creatorsTitle: "Livestream Từ Các Creator Pickleball",
      creatorsDesc: "Theo dõi các creator pickleball yêu thích và không bỏ lỡ trận đấu nào. Các creator thường xuyên phát sóng giải đấu, buổi tập luyện và các trận giao hữu. Nhận điểm số real-time, bình luận trực tiếp và cảm nhận sự phấn khích của pickleball ngay trên thiết bị của bạn.",
      upcomingTitle: "Lịch Phát Sóng & Livestream Sắp Tới",
      upcomingDesc: "Xem lịch phát sóng và đặt nhắc nhở cho các trận đấu bạn không muốn bỏ lỡ. Dù bạn tìm kiếm giải phong trào hay giải đấu cạnh tranh với bracket pickleball, ThePickleHub đáp ứng mọi nhu cầu xem livestream của bạn.",
    },
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
    hubTitle: "Phần Mềm Quản Lý Giải Pickleball",
    hubDescription: "Nền tảng toàn diện để tổ chức và quản lý giải đấu pickleball mọi quy mô.",
    seo: {
      createTitle: "Tạo, Quản Lý và Điều Hành Giải Pickleball",
      createDesc: "ThePickleHub cung cấp phần mềm quản lý giải đấu pickleball mạnh mẽ dành riêng cho ban tổ chức. Dù bạn tổ chức giải phong trào nhỏ hay sự kiện cạnh tranh lớn, nền tảng của chúng tôi xử lý mọi thứ từ đăng ký VĐV đến tạo bracket và chấm điểm trực tiếp.",
      formatsTitle: "Hỗ Trợ Bracket, Team Match và Livestream",
      formatsDesc: "Phần mềm giải đấu pickleball của chúng tôi hỗ trợ nhiều thể thức bao gồm round robin, loại trực tiếp đơn, loại trực tiếp kép và thi đấu đồng đội. Tích hợp livestream pickleball trực tiếp vào giải để tiếp cận nhiều khán giả hơn. VĐV có thể xem bracket, kiểm tra lịch thi đấu và theo dõi kết quả real-time từ mọi thiết bị.",
      builtTitle: "Xây Dựng Cho Giải Pickleball Thực Tế",
      builtDesc: "Được sử dụng bởi các giám đốc giải đấu và câu lạc bộ pickleball trên toàn thế giới, phần mềm giải đấu của ThePickleHub được xây dựng từ kinh nghiệm thực tế tổ chức các sự kiện pickleball cạnh tranh. Từ giải phong trào đến giải chuyên nghiệp, nền tảng của chúng tôi mở rộng để đáp ứng nhu cầu với các tính năng như xếp sân, quản lý trọng tài và tính toán bảng xếp hạng tự động.",
    },
    openRegistration: "Đang mở đăng ký",
    featured: "Nổi bật",
    multiEvent: "Giải tổng (nhiều nội dung)",
    pairs: "đôi",
    players: "người",
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
    settings: {
      title: "Cài đặt hệ thống",
      livestreamGate: "Cài đặt Livestream",
      requireLogin: "Yêu cầu đăng nhập để xem",
      requireLoginDesc: "Người xem phải đăng nhập hoặc đăng ký để xem livestream sau thời gian xem thử",
      previewDuration: "Thời gian xem thử",
      previewDurationDesc: "Số giây cho phép xem trước khi yêu cầu đăng nhập",
      appliesTo: "Áp dụng cho",
      appliesToAll: "Tất cả",
      appliesToLive: "Chỉ trực tiếp",
      appliesToReplay: "Chỉ xem lại",
      savedSuccess: "Đã lưu cài đặt thành công",
      geoBlock: "Chặn theo khu vực",
      geoBlockEnabled: "Bật chặn khu vực",
      geoBlockEnabledDesc: "Chặn người dùng từ các quốc gia được chọn xem livestream và video",
      blockedCountries: "Quốc gia bị chặn",
      blockedCountriesDesc: "Danh sách mã quốc gia (ISO 3166-1 alpha-2), cách nhau bởi dấu phẩy",
      tournamentGate: "Truy cập chi tiết giải đấu",
      requireLoginTournament: "Yêu cầu đăng nhập để xem chi tiết giải",
      requireLoginTournamentDesc: "Người xem phải đăng nhập để xem trang chi tiết giải đấu (Quick Table, Team Match, Doubles Elimination, Flex Tournament)",
    },
    viewers: {
      title: "Danh sách người xem",
      description: "Xem realtime danh sách người đang xem livestream",
      selectLivestream: "Chọn livestream",
      selectPlaceholder: "Chọn livestream để xem danh sách...",
      noActiveLivestreams: "Không có livestream nào đang phát",
      viewerList: "Người xem",
      viewer: "Người xem",
      watching: "đang xem",
      connected: "Đã kết nối",
      disconnected: "Đang kết nối...",
      noViewers: "Chưa có ai đang xem",
      anonymous: "Ẩn danh",
      loggedIn: "Đã đăng nhập",
      joinedAt: "Tham gia lúc",
      type: "Loại",
    },
    auditLog: {
      title: "Audit Log",
      description: "Lịch sử hoạt động hệ thống",
    },
  },
  geoBlock: {
    title: "Nội dung không khả dụng",
    description: "Nội dung này không khả dụng tại khu vực của bạn. / This content is not available in your region.",
  },
  player: {
    tapToPlayVideo: "Chạm để xem video",
    tapToWatchLive: "Chạm để xem trực tiếp",
    notReady: "Video chưa sẵn sàng",
    playbackError: "Không thể phát",
    playbackErrorDesc: "Không thể phát trên trình duyệt này. Hãy thử reload hoặc đổi mạng.",
    reconnecting: "Đang kết nối lại...",
    connectionLost: "Mất kết nối, đang thử lại...",
    autoRetry: "Tự động thử lại sau {seconds} giây",
    retryFailed: "Không thể kết nối lại. Vui lòng thử lại.",
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
    nickname: "Biệt danh",
    nicknamePlaceholder: "Nhập biệt danh của bạn",
    nicknameUpdated: "Đã cập nhật biệt danh",
    nicknameError: "Lỗi biệt danh",
    nicknameLengthError: "Biệt danh phải từ 2-30 ký tự",
    nextEdit: "Lần đổi tiếp",
    pin: "Ghim",
    unpin: "Bỏ ghim",
    pinnedMessage: "Tin nhắn được ghim",
    topChatters: "Top chat",
    messages: "tin nhắn",
    highlight: "Đánh dấu nổi bật",
    removeHighlight: "Bỏ đánh dấu",
    like: "Thích",
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
    socialLink: "Link chia sẻ (Facebook, Zalo...)",
    socialLinkDesc: "Dùng link này khi share lên mạng xã hội để hiển thị đúng tiêu đề & hình ảnh",
    directLink: "Link trực tiếp",
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
    openRegistrationTitle: "Giải đang mở đăng ký",
    expectedPlayers: "Dự kiến {count} người",
    expectedPairs: "Dự kiến {count} đôi",
    registering: "Đang đăng ký",
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
      disclaimer: "BTC dựa vào điểm tự khai và sẽ đối chiếu với các hệ điểm để ra quyết định cuối cùng trong trường hợp có tranh chấp.",
      pendingTitle: "Đăng ký thành công!",
      pendingDesc: "Đăng ký của bạn đang chờ BTC xem xét và phê duyệt.",
      approvedTitle: "Đã được phê duyệt!",
      approvedDesc: "Bạn đã được phê duyệt tham dự giải",
      approvedWaiting: "Vui lòng chờ kết quả chia bảng từ BTC.",
      infoTitle: "Thông tin đăng ký của bạn:",
      infoName: "Tên",
      cancelConfirm: "Bạn có chắc muốn hủy đăng ký?",
      cancelRegistration: "Hủy đăng ký",
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
    // SEO content
    seo: {
      pageTitle: "Công cụ Chia Bảng Pickleball",
      pageSubtitle: "Tạo bảng đấu cho giải pickleball của bạn trong vài giây",
      createTitle: "Tạo Bảng Đấu Pickleball Trong Vài Giây",
      createDesc: "Công cụ chia bảng pickleball của ThePickleHub giúp tổ chức giải đấu trở nên dễ dàng. Chỉ cần nhập số VĐV, chọn thể thức và nhận bảng đấu hoàn chỉnh ngay lập tức. Công cụ xử lý mọi phức tạp của lịch thi đấu round robin, xếp hạng playoff và thứ tự trận đấu để bạn tập trung vào việc thi đấu.",
      roundRobinTitle: "Công Cụ Round Robin Cho Giải Pickleball",
      roundRobinDesc: "Thể thức round robin đảm bảo mọi VĐV hoặc đội đều thi đấu với nhau. Công cụ tự động tạo bảng cân bằng, tính toán số trận tối ưu và sắp xếp lịch để giảm thiểu thời gian chờ. Hoàn hảo cho giải phong trào nơi mọi người đều muốn tối đa thời gian thi đấu.",
      formatsTitle: "Hỗ Trợ Playoff, Loại Trực Tiếp & Thể Thức Tùy Chỉnh",
      formatsDesc: "Ngoài round robin, công cụ chia bảng còn hỗ trợ playoff loại trực tiếp đơn, vòng bảng kết hợp knockout và thể thức giải lớn cho 50+ VĐV. Theo dõi điểm số real-time, chia sẻ bracket trực tiếp với người tham gia và tìm ra nhà vô địch với bảng đấu chuyên nghiệp.",
    },
    // Additional UI text
    setup: {
      inputPlayers: "Nhập danh sách người chơi",
      inputPlayersDesc: "Nhập tên và hạt giống (tùy chọn)",
      shuffle: "Xáo trộn",
      playerNamePlaceholder: "Tên VĐV *",
      teamPlaceholder: "Team",
      seedPlaceholder: "Seed",
      addPlayer: "Thêm người chơi",
      assignmentMethod: "Phương thức chia bảng",
      autoMode: "Tự động",
      autoModeDesc: "Hệ thống chia đều, tránh cùng team, rải seed",
      manualMode: "Thủ công",
      manualModeDesc: "Tự chọn VĐV vào từng bảng",
      tips: "Mẹo chia bảng tốt:",
      tipTeam: "Nhập Team để tránh cùng team vào cùng bảng",
      tipSeed: "Đánh số Seed (1 = mạnh nhất) để rải hạt giống đều các bảng",
      tipAuto: "Hệ thống sẽ tự động chia người chơi vào các bảng đều nhau",
      tipManual: "Bạn sẽ tự phân VĐV vào từng bảng ở bước tiếp theo",
      processing: "Đang xử lý...",
      continueManual: "Tiếp tục chia bảng",
      createBracketBtn: "Tạo bảng đấu và chia bảng",
      minPlayersError: "Cần ít nhất 2 người chơi",
      notFound: "Không tìm thấy bảng đấu",
      notFoundDesc: "Bảng đấu không tồn tại hoặc đã bị xóa.",
      createdSuccess: "Đã tạo bảng đấu thành công!",
      manualSuccess: "Đã chia bảng thủ công thành công!",
      errorOccurred: "Có lỗi xảy ra, vui lòng thử lại",
    },
    manualAssignment: {
      title: "Chia bảng thủ công",
      description: "Phân VĐV vào các bảng theo ý muốn của bạn",
      guide: "Hướng dẫn chia bảng thủ công",
      step1: "Click chọn VĐV từ danh sách bên trái",
      step2: "Click vào bảng muốn đưa VĐV vào",
      step3: "Click vào VĐV đã chia để xóa khỏi bảng",
      unassigned: "Chưa phân bảng",
      allAssigned: "Tất cả VĐV đã được phân bảng",
      group: "Bảng",
      clickToAdd: "Click để thêm VĐV",
      noPlayers: "Chưa có VĐV",
      warning: "Cảnh báo",
      unbalancedGroups: "Các bảng không cân bằng số lượng VĐV",
      sameTeamWarning: "VĐV cùng team",
      topSeedsWarning: "hạt giống cao (seed 1-2)",
      confirm: "Xác nhận chia bảng",
      remainingPlayers: "Còn {count} VĐV chưa phân bảng",
      emptyGroup: "Có bảng chưa có VĐV",
    },
    view: {
      groupStage: "Vòng bảng",
      shareSuccess: "Đã sao chép link!",
      deleteConfirm: "Bạn có chắc chắn muốn xoá giải \"{name}\"? Tất cả dữ liệu (VĐV, trận đấu, đăng ký...) sẽ bị xoá vĩnh viễn.",
      deleteBtn: "Xoá giải",
      groupCompleteTitle: "Vòng bảng đã hoàn tất!",
      groupCompleteDesc: "Tất cả trận đấu đã có kết quả. Bạn có thể chuyển sang vòng Playoff.",
      startPlayoff: "Bắt đầu Playoff",
      registrationTab: "Đăng ký",
      playoffTab: "Playoff",
      standings: "Bảng xếp hạng",
      player: "Người chơi",
      wins: "Thắng",
      matches: "Trận",
      pointDiff: "Hiệu số",
      actions: "Thao tác",
      matchList: "Danh sách trận đấu",
      showTeam: "Hiện Team",
      courtTime: "Sân & Giờ",
      addPlayer: "Thêm VĐV",
      done: "Xong",
      editGroups: "Sửa bảng",
      movePlayer: "Chuyển bảng",
      removePlayer: "Xóa VĐV",
      removeConfirm: "Xóa {name} khỏi bảng?",
      movePlayerTitle: "Chuyển VĐV sang bảng khác",
      selectGroup: "Chọn bảng",
      moveBtn: "Chuyển",
      movedSuccess: "Đã chuyển VĐV",
      addPlayerTitle: "Thêm VĐV mới",
      playerName: "Tên VĐV",
      team: "Team (tùy chọn)",
      addBtn: "Thêm",
      addedSuccess: "Đã thêm VĐV",
      removedSuccess: "Đã xóa VĐV",
      scoreUpdated: "Đã cập nhật kết quả",
      nextRoundCreated: "Đã tạo vòng tiếp theo!",
      tournamentCompleted: "Giải đấu đã hoàn tất! 🎉",
      playoffCreated: "Đã tạo vòng Playoff!",
      onlyCreatorCanScore: "Chỉ người tạo bảng hoặc trọng tài mới có thể nhập điểm.",
      wildcardTitle: "Chọn Wildcard",
      wildcardDesc: "Chọn {count} VĐV hạng 3 để vào Playoff",
      selectExactly: "Vui lòng chọn đúng {count} người",
      courtsTimeUpdated: "Đã cập nhật sân & giờ thi đấu",
      notFound: "Không tìm thấy bảng đấu",
      goBack: "Quay lại",
      group: "Bảng",
      court: "Sân",
      inputScore: "Nhập",
      loading: "Đang tải...",
      deleteTournament: "Xoá giải",
      deleteConfirmFull: "Bạn có chắc chắn muốn xoá giải \"{name}\"? Tất cả dữ liệu sẽ bị xoá vĩnh viễn.",
      recommended: "Khuyến nghị",
      confirm: "Xác nhận",
      cancel: "Hủy",
      move: "Chuyển",
      add: "Thêm",
      save: "Lưu",
      enterName: "Nhập tên",
      enterTeam: "Nhập team",
      addToGroup: "Thêm vào bảng",
      moveToGroup: "Chuyển {name} sang bảng khác",
      selectTargetGroup: "Chọn bảng đích",
      addPlayerName: "Tên VĐV",
      addPlayerTeam: "Team (không bắt buộc)",
      editInlineScore: "Sửa",
      inputInlineScore: "Nhập",
      openScoringPage: "Chấm",
      cancelEdit: "Hủy",
      saveScore: "Lưu",
      errorOccurred: "Có lỗi xảy ra",
      groupLabel: "Bảng",
      winsLabel: "thắng",
      pointDiffLabel: "Hiệu số",
      courtName: "Tên sân",
      courtNamePlaceholder: "VD: Sân 1, Court A",
      courtNameSaved: "Đã lưu tên sân",
    },
    parentTournament: {
      selectType: "Chọn loại giải",
      singleTitle: "Giải đơn lẻ",
      singleDesc: "Phù hợp cho giải nhỏ, giải club, giải giao hữu — chỉ có 1 nội dung thi đấu duy nhất.",
      multiTitle: "Giải tổng (nhiều nội dung)",
      multiDesc: "Phù hợp cho các đơn vị tổ chức giải lớn có nhiều nội dung con (ví dụ: Đôi Nam Mở rộng, Đôi Nữ U25, Đôi Nam Nữ Trên 35...).",
      createParent: "Tạo giải tổng",
      parentName: "Tên giải tổng",
      parentNamePlaceholder: "VD: TPP Championship 2026",
      eventDate: "Ngày thi đấu",
      location: "Địa điểm",
      locationPlaceholder: "VD: VNBC Quận 7, TP.HCM",
      description: "Mô tả",
      descriptionPlaceholder: "Giới thiệu về giải đấu...",
      addSubEvent: "+ Thêm nội dung",
      subEvents: "Nội dung thi đấu",
      noSubEvents: "Chưa có nội dung nào. Nhấn \"+ Thêm nội dung\" để bắt đầu.",
      subEventCount: "{count} nội dung",
      viewParent: "Xem giải tổng",
      deleteParentConfirm: "Bạn phải xoá tất cả nội dung con trước khi xoá giải tổng.",
      moreEvents: "+ {count} nội dung khác",
      noEventsYet: "Chưa có nội dung nào",
      addFirstEvent: "+ Thêm nội dung",
    },
    playoffPreview: {
      title: "Preview Bracket Playoff",
      subtitle: "16 đội vào playoff — kiểm tra trước khi xác nhận",
      seed: "Seed",
      fromGroup: "Bảng",
      conflictWarning: "Có cặp đấu cùng bảng!",
      clickToSwap: "Nhấn vào 2 VĐV ở 2 cặp khác nhau để hoán đổi vị trí.",
      autoResolve: "Tự động giải quyết",
      confirmBracket: "Xác nhận bracket",
      noConflicts: "Không có xung đột — sẵn sàng tạo bracket!",
      unresolvedConflicts: "Không thể tự động giải quyết {count} cặp xung đột. Vui lòng hoán đổi thủ công.",
    },
    groups: {
      groups: "bảng",
      playersPerGroup: "người/bảng",
      advanceToPlayoff: "người vào Playoff",
      noConfig: "Không có cấu hình phù hợp với {count} người.",
      tryOther: "Thử số người chơi khác.",
      quotaUsed: "{count}/{total} giải đã tạo",
    },
    // Match Scoring Page
    matchScoring: {
      loading: "Đang tải...",
      matchNotFound: "Không tìm thấy trận đấu",
      loadError: "Lỗi tải dữ liệu",
      scoreUpdateError: "Lỗi cập nhật điểm",
      noPermission: "Không có quyền truy cập",
      noPermissionDesc: "Bạn cần là Creator hoặc Trọng tài để chấm điểm",
      backToBracket: "Quay lại bảng đấu",
      goBack: "Quay lại",
      live: "LIVE",
      ended: "Đã kết thúc",
      match: "Trận",
      final: "Chung kết",
      semiFinal: "Bán kết",
      quarterFinal: "Tứ kết",
      round: "Vòng",
      claimSuccess: "Bạn đang chấm điểm trận này",
      otherRefereeScoring: "Trọng tài khác đang chấm điểm trận này",
      resetScore: "Reset điểm",
      resetConfirmTitle: "Reset điểm số?",
      resetConfirmDesc: "Điểm số sẽ được đặt về 0 — 0",
      resetSuccess: "Đã reset điểm",
      endMatch: "Kết thúc trận",
      endMatchConfirmTitle: "Kết thúc trận đấu?",
      endMatchConfirmDesc: "Kết quả cuối cùng",
      finalResult: "Kết quả cuối cùng",
      winner: "Người thắng",
      tieWarning: "Điểm hòa - không có người thắng",
      confirm: "Xác nhận",
      cancel: "Hủy",
      endMatchSuccess: "Đã kết thúc trận đấu",
      endMatchError: "Lỗi kết thúc trận đấu",
      nextMatch: "Trận tiếp theo",
      noNextMatch: "Không còn trận đấu tiếp theo",
      // New keys for enhanced scoring
      swapSides: "Đổi sân",
      swapServe: "Đổi giao bóng",
      undo: "Hoàn tác",
      set: "Set",
      start: "Bắt đầu",
      pause: "Tạm dừng",
      serving: "Giao",
      timeout: "Timeout",
      endSet: "Kết thúc set",
      endSetConfirmTitle: "Kết thúc set?",
      endSetConfirmDesc: "Lưu điểm set này và chuyển sang set tiếp theo",
      setWinner: "Thắng set",
      matchWinner: "Thắng trận",
      bestOf: "Best of",
      setsWon: "set thắng",
      currentSet: "Set hiện tại",
      timerRunning: "Đang chạy",
      startMatch: "Bắt đầu trận",
      timeoutExpired: "Hết thời gian time out!",
      timeoutExhausted: "Đã hết lượt Time Out!",
      medicalExhausted: "Đã hết lượt Y tế!",
      timeoutLabel: "Time Out",
      medicalLabel: "Y tế",
      endEarly: "Kết thúc sớm",
      noteLeftPlaceholder: "Ghi chú VĐV trái...",
      noteRightPlaceholder: "Ghi chú VĐV phải...",
      serverNumberTitle: "Tay giao (bấm để đổi)",
      serverNumberServing: "Tay {n} đang giao",
      matchSettings: "Cài đặt trận đấu",
      selectServingSide: "Chọn bên giao bóng trước",
      timeoutsPerSide: "Số lần Time Out mỗi bên",
      medicalNote: "Y tế: mặc định 1 lần mỗi bên (5 phút)",
      defaultSets: "Số set mặc định",
    },
  },
  // Team Match SEO
  teamMatch: {
    pageTitle: "Thể Thức Thi Đấu Đồng Đội Pickleball",
    pageSubtitle: "Tạo và quản lý giải đấu đồng đội theo phong cách MLP",
    myTournaments: "Giải đấu của tôi",
    publicTournaments: "Giải đấu MLP đang mở",
    noTournaments: "Bạn chưa tạo giải đấu đồng đội nào",
    createFirst: "Tạo giải đấu đầu tiên",
    loginPrompt: "Đăng nhập để tạo và quản lý giải đấu đồng đội",
    createNew: "Tạo mới",
    viewDetails: "Xem chi tiết",
    confirmDelete: "Xác nhận xóa?",
    confirmDeleteDesc: "Bạn có chắc muốn xóa \"{name}\"? Hành động này không thể hoàn tác.",
    cancel: "Hủy",
    delete: "Xóa",
    teams: "đội",
    players: "người",
    formatRoundRobin: "Vòng tròn",
    formatSingleElim: "Loại trực tiếp",
    formatRrPlayoff: "Vòng tròn + Playoff",
    statusSetup: "Đang thiết lập",
    statusRegistration: "Đang đăng ký",
    statusOngoing: "Đang diễn ra",
    statusCompleted: "Đã kết thúc",
    seo: {
      mlpTitle: "Giải Đấu Đồng Đội Pickleball Theo Phong Cách MLP",
      mlpDesc: "Thể thức thi đấu đồng đội pickleball mang đến trải nghiệm thi đấu chuyên nghiệp cho câu lạc bộ hoặc giải của bạn. Lấy cảm hứng từ Major League Pickleball (MLP), thể thức này có các đội thi đấu qua nhiều nội dung bao gồm đôi nam, đôi nữ và đôi nam nữ. Tạo sự cạnh tranh đội hấp dẫn với các công cụ quản lý đội toàn diện.",
      lineupTitle: "Lineup, Dreambreaker & Rally Scoring",
      lineupDesc: "Hệ thống thi đấu đồng đội hỗ trợ quản lý lineup đầy đủ, cho phép đội trưởng sắp xếp VĐV chiến lược cho từng trận. Khi trận đấu hòa, thể thức dreambreaker mang đến gameplay đột tử hấp dẫn. Rally scoring giữ mọi điểm đều căng thẳng và đảm bảo trận đấu duy trì nhịp độ cạnh tranh.",
      manageTitle: "Quản Lý Thi Đấu Đồng Đội Cho Giải Pickleball",
      manageDesc: "Dù tổ chức trận giao hữu giữa các câu lạc bộ hay một mùa giải đầy đủ, công cụ thi đấu đồng đội của ThePickleHub xử lý mọi phức tạp. Theo dõi bảng xếp hạng đội, quản lý đội hình, lên lịch trận đấu và tính toán kết quả tự động. Kết hợp với công cụ chia bảng để có trải nghiệm quản lý giải đấu và thi đấu đồng đội đáng nhớ.",
    },
    scoring: {
      title: "Chấm điểm",
      saveScore: "Lưu điểm",
      saving: "Đang lưu...",
      saved: "Đã lưu kết quả",
      scoreSaveError: "Không thể lưu điểm",
      game: "Game",
      selectGame: "Chọn game để chấm điểm",
      matchComplete: "Trận đấu đã hoàn thành",
      reset: "Đặt lại",
      confirmReset: "Xác nhận đặt lại điểm?",
    },
    setup: {
      title: "Tạo giải đấu đồng đội",
      subtitle: "Kiểu MLP - Major League Pickleball",
      stepBasicInfo: "Thông tin cơ bản",
      stepGameTemplates: "Game Templates",
      stepDreambreaker: "DreamBreaker",
      stepFormat: "Thể thức",
      tournamentName: "Tên giải đấu",
      tournamentNamePlaceholder: "VD: MLP Mùa Xuân 2026",
      playersPerTeam: "Số VĐV mỗi đội",
      teamCount: "Số đội",
      requireRegistration: "Yêu cầu đăng ký trước",
      requireRegistrationDesc: "Đội trưởng tạo đội và mời thành viên",
      requireMinGames: "Mỗi VĐV ít nhất 1 game",
      requireMinGamesDesc: "Bắt buộc lineup sử dụng tất cả thành viên",
      formatRoundRobin: "Vòng tròn (Round Robin)",
      formatRoundRobinDesc: "Tất cả các đội đấu với nhau",
      formatSingleElimination: "Loại trực tiếp (Single Elimination)",
      formatSingleEliminationDesc: "Thua 1 trận là bị loại",
      formatRrPlayoff: "Vòng bảng + Playoff",
      formatRrPlayoffDesc: "Vòng tròn theo bảng, sau đó playoff",
      thirdPlaceMatch: "Có trận tranh hạng 3",
      thirdPlaceMatchDesc: "Trận đấu giữa 2 đội thua bán kết",
      playoffTeams: "Số đội vào Playoff",
      playoffTeamsDesc: "Số đội từ vòng bảng vào playoff",
      creating: "Đang tạo...",
      createBtn: "Tạo giải đấu",
      invalidTeamCount: "Số đội phải là 4, 8, 16 hoặc 32 cho thể thức loại trực tiếp",
      loginRequired: "Đăng nhập để tiếp tục",
      loginRequiredDesc: "Bạn cần đăng nhập để tạo giải đấu đồng đội",
    },
    view: {
      overview: "Tổng quan",
      teams: "Đội",
      matches: "Trận đấu",
      standings: "Xếp hạng",
      settings: "Cài đặt",
      copyLink: "Sao chép link",
      linkCopied: "Đã sao chép link!",
      yourTeam: "Đội của bạn",
      youAreCaptain: "Bạn là đội trưởng của đội này",
      members: "Thành viên",
      rosterFull: "Đủ đội",
      rosterIncomplete: "Chưa đủ",
      manageTeam: "Quản lý đội",
      registerPrompt: "Đăng ký tham gia giải đấu",
      createTeam: "Tạo đội",
      inviteTeam: "Mời đội",
      generateBracket: "Sinh Bracket",
      generateMatches: "Tạo lịch thi đấu",
      createGroups: "Chia bảng",
      startTournament: "Bắt đầu giải đấu",
      createPlayoff: "Tạo vòng Playoff",
      approveAllFirst: "Cần duyệt tất cả đội trước khi chia bảng",
      needMinTeams: "Cần ít nhất {count} đội",
      matchesCreated: "{count} trận đã tạo",
      roundRobinComplete: "Vòng tròn đã hoàn thành",
      btcActions: "Hành động BTC",
      approveBeforeGroups: "Duyệt {count} đội đang chờ trước khi chia bảng",
      groupStage: "Vòng bảng",
      roundRobin: "Vòng tròn",
      playoffRound: "Vòng Playoff",
      seBracket: "Bracket Loại Trực Tiếp",
      noMatches: "Chưa có trận đấu nào",
      noMatchesDesc: "Lịch thi đấu sẽ được BTC tạo",
      startConfirm: "Bắt đầu giải đấu?",
      startConfirmDesc: "Sau khi bắt đầu, giải đấu sẽ chuyển sang trạng thái \"Đang diễn ra\" và không thể thêm/xóa đội nữa.",
      start: "Bắt đầu",
      teamsReady: "{count} đội đã sẵn sàng",
      createSchedule: "Tạo lịch thi đấu",
      deleteConfirm: "Xoá giải đấu?",
      deleteConfirmDesc: "Hành động này không thể hoàn tác. Tất cả dữ liệu sẽ bị xoá vĩnh viễn.",
      notFound: "Không tìm thấy giải đấu",
      notFoundDesc: "Giải đấu này không tồn tại hoặc đã bị xóa",
      backToList: "Quay lại danh sách",
      deleteBtn: "Xoá giải",
      registerForTournament: "Đăng ký tham gia giải đấu",
      createTeamToJoin: "Tạo đội mới để tham gia",
      btcActionsTitle: "Hành động BTC",
      inviteTeamBtn: "Mời đội",
      createGroupsBtn: "Chia bảng",
      generateBracketBtn: "Sinh Bracket",
      roundStarted: "Đã bắt đầu vòng",
      createPlayoffTitle: "Tạo vòng Playoff",
      createPlayoffDesc: "Vòng tròn đã hoàn thành",
      createScheduleBtn: "Tạo lịch thi đấu",
      createScheduleDesc: "Mời đội hoặc tạo lịch thi đấu",
      noMatchesEmpty: "Chưa có trận đấu nào",
      noMatchesScheduleDesc: "Lịch thi đấu sẽ được BTC tạo",
      startTournamentTitle: "Bắt đầu giải đấu?",
      startTournamentDesc: "Sau khi bắt đầu, giải đấu sẽ chuyển sang trạng thái \"Đang diễn ra\" và không thể thêm/xóa đội nữa.",
      startBtn: "Bắt đầu",
      teamsReadyCount: "đội đã sẵn sàng",
      generateScheduleBtn: "Tạo lịch",
      seBracketTitle: "Bracket Loại Trực Tiếp",
      groupStageTitle: "Vòng bảng",
      roundRobinTitle: "Vòng tròn",
      approveBeforeBracket: "Cần duyệt tất cả đội trước khi tạo bracket",
      inviteOrCreateSchedule: "Mời đội hoặc tạo lịch thi đấu",
      inviteOrBracket: "Mời đội hoặc tạo bracket Single Elimination",
      needMinTeamsForBracket: "Cần ít nhất 6 đội để chia bảng",
      cancelBtn: "Huỷ",
      deleteAction: "Xoá",
      errorOccurred: "Lỗi",
      roundRobinDone: "Vòng tròn đã hoàn thành — {count} đội đủ điều kiện",
      teamsReadyForSchedule: "{count} đội đã sẵn sàng",
      teamsReadySE: "{count} đội đã sẵn sàng (Single Elimination)",
      startTournamentLabel: "Bắt đầu giải đấu",
      matchesGeneratedCount: "{count} trận đấu được tạo",
      approveAllBeforeBracket: "Cần duyệt tất cả đội trước khi tạo bracket",
      needMin6Groups: "Cần ít nhất 6 đội để chia bảng",
      approvePendingFirst: "Duyệt {count} đội đang chờ trước khi chia bảng",
      approvePendingBracket: "Duyệt {count} đội đang chờ trước khi tạo bracket",
      inviteOrSchedule: "Mời đội hoặc tạo lịch thi đấu",
    },
    roster: {
      title: "Danh sách thành viên",
      countLabel: "{count}/{max} VĐV",
      inviteCode: "Mã mời",
      addMember: "Thêm thành viên",
      addFromPrevious: "Chọn từ giải trước",
      memberName: "Tên thành viên",
      gender: "Giới tính",
      male: "Nam",
      female: "Nữ",
      skillLevel: "Trình độ",
      optional: "Tùy chọn",
      removeMember: "Xóa thành viên?",
      removeMemberDesc: "Bạn có chắc muốn xóa {name} khỏi đội?",
      rosterFull: "Đội đã đủ số lượng thành viên",
      captain: "Đội trưởng",
      noMembers: "Chưa có thành viên nào",
      addedSuccess: "Đã thêm {count} thành viên",
    },
    standings: {
      rank: "#",
      team: "Đội",
      played: "Tr",
      won: "T",
      lost: "B",
      points: "Đ",
      games: "Ván",
      diff: "+/-",
      legend: {
        played: "Số trận",
        won: "Thắng",
        lost: "Thua",
        points: "Điểm (Thắng = 1đ)",
        diff: "Hiệu số",
      },
    },
    dialog: {
      generateMatches: "Tạo lịch thi đấu?",
      generateMatchesDesc: "Hệ thống sẽ tự động tạo lịch thi đấu vòng tròn cho các đội đã được duyệt.",
      teamsCount: "{count} đội",
      matchesCount: "{count} trận",
      roundsCount: "{count} vòng",
      gamesPerMatch: "{count} ván/trận",
      minTeamsRequired: "Cần ít nhất 2 đội đã được duyệt để tạo lịch thi đấu",
      incompleteRosters: "Không thể tạo lịch - Có đội chưa đủ người",
      confirm: "Xác nhận",
    },
  },
  // Doubles Elimination translations
  doublesElimination: {
    title: "Doubles Elimination",
    description: "Thể thức loại trực tiếp có nhánh thua cho giải 32+ đội",
    createNew: "Tạo giải mới",
    loginRequired: "Đăng nhập để tạo giải đấu",
    loginRequiredDesc: "Bạn cần đăng nhập để tạo và quản lý các giải đấu Doubles Elimination",
    noTournaments: "Chưa có giải đấu nào",
    noTournamentsDesc: "Tạo giải đấu Doubles Elimination đầu tiên của bạn",
    viewBtn: "Xem",
    teams: "đội",
    earlyRounds: "Vòng ngoài",
    semifinalPlus: "Bán kết+",
    status: {
      setup: "Đang cài đặt",
      ongoing: "Đang diễn ra",
      completed: "Đã hoàn thành",
    },
    format: {
      bo1: "BO1",
      bo3: "BO3",
      bo5: "BO5",
    },
    about: {
      title: "Về thể thức Doubles Elimination",
      description: "Doubles Elimination là thể thức loại trực tiếp cải tiến, cho phép các đội có cơ hội thứ hai sau khi thua ở vòng đầu.",
      round1: "Tất cả đội thi đấu. Thua → xuống nhánh thua",
      round2: "Đội thua R1 đấu nhau. Thua lần 2 → loại",
      round3: "Hợp nhất nhánh thắng + thua, chuẩn hóa về 2^n đội",
      round4Plus: "Single Elimination chuẩn đến chung kết",
      minTeams: "Số đội tối thiểu: 32 đội.",
      suggestion: "Gợi ý: 32, 40, 48, 64, 80, 96, 128 đội.",
    },
    setup: {
      title: "Tạo giải Doubles Elimination",
      tournamentName: "Tên giải đấu",
      tournamentNamePlaceholder: "VD: Giải Pickleball Mùa Hè 2024",
      teamCount: "Số đội tham gia",
      minTeamsError: "Cần tối thiểu 32 đội",
      courtCount: "Số sân thi đấu",
      startTime: "Giờ bắt đầu",
      earlyRoundsFormat: "Thể thức vòng ngoài (R1-R2)",
      semifinalsFormat: "Thể thức bán kết",
      finalsFormat: "Thể thức chung kết",
      thirdPlaceMatch: "Có trận tranh hạng 3",
      thirdPlaceMatchDesc: "Đội thua bán kết sẽ đấu tranh hạng 3",
      creating: "Đang tạo...",
      createBtn: "Tạo giải đấu",
      shuffled: "Đã xáo trộn thứ tự đội",
      nameRequired: "Vui lòng nhập tên giải đấu",
      need32Teams: "Cần ít nhất 32 đội",
      createError: "Lỗi tạo giải đấu",
      addTeamsError: "Lỗi thêm đội",
      bracketError: "Lỗi tạo bracket",
      createSuccess: "Tạo giải đấu thành công!",
      hints: {
        byeCount: "{count} đội được BYE vào R2",
        r1Matches: "{count} trận ở R1",
        r2Matches: "{count} trận ở R2",
      },
    },
    scoring: {
      match: "Trận",
      court: "Sân",
      time: "Giờ",
      vs: "vs",
      tbd: "TBD",
      edit: "Sửa",
      score: "Chấm",
      waiting: "Chờ đủ 2 đội",
      winner: "Thắng",
      saveSuccess: "Đã lưu kết quả",
      saveError: "Lỗi khi lưu điểm",
    },
    view: {
      notFound: "Không tìm thấy giải đấu",
      backToList: "Quay lại danh sách",
      preliminary: "Sơ loại",
      playoff: "Playoff",
      teams: "Đội",
      settings: "Cài đặt",
      teamList: "Danh sách đội",
      tournamentSettings: "Cài đặt giải đấu",
      thirdPlaceMatch: "Tranh hạng 3",
      courts: "Số sân",
      yes: "Có",
      no: "Không",
      share: "Chia sẻ",
      copied: "Đã sao chép",
      copyError: "Không thể sao chép",
      deleteConfirm: "Xóa giải đấu?",
      deleteConfirmDesc: "Hành động này không thể hoàn tác. Tất cả dữ liệu sẽ bị xóa vĩnh viễn.",
      deleteSuccess: "Đã xóa giải đấu",
      deleteError: "Lỗi xóa giải đấu",
      eliminatedRound: "Loại R",
      r3AssignedTitle: "Đã phân vòng 3",
      r3TiedDesc: "Có {count} VĐV trùng hiệu số ({names}). Chương trình đã ghép ngẫu nhiên 2 VĐV thi đấu trận sơ loại.",
      r3NormalDesc: "Các VĐV đã được phân vào vòng tiếp theo dựa trên hiệu số.",
    },
    bracket: {
      round: "Vòng",
      match: "Trận",
      winnerBracket: "Winner Bracket",
      loserBracket: "Loser Bracket",
      finalElimination: "Sơ loại cuối",
      champion: "Vô địch",
      finals: "Chung kết",
      thirdPlace: "Tranh hạng 3",
      quarterFinal: "Tứ kết",
      semiFinal: "Bán kết",
      round16: "Vòng 16",
      done: "Xong",
      openScoring: "Chấm",
      editScore: "Sửa",
      assignR3: "Phân vòng 3",
      assigning: "Đang phân vòng...",
      waitingAssignment: "Chờ phân vòng",
      waitingR1R2: "Chờ V1 & V2",
      noMatches: "Không có trận",
      noBracket: "Chưa có bracket. Hãy hoàn tất cài đặt để tạo bracket.",
      playoffNotReady: "Vòng playoff sẽ bắt đầu sau khi hoàn thành vòng sơ loại.",
      tieNotAllowed: "Điểm không được bằng nhau",
      loserOf: "Thua trận",
      clickGameToEdit: "Click vào ô game để sửa điểm",
      waitingTeams: "Chờ đủ 2 đội để chấm điểm",
      finalBadge: "CK",
      scoreSaved: "Đã lưu điểm",
      matchSaved: "Đã lưu kết quả",
      gameSaved: "Đã lưu Game",
      scoreSaveError: "Lỗi lưu điểm",
      playoffCreated: "Đã tạo playoff",
      playoffCreatedDesc: "Lịch thi đấu vòng playoff đã được tạo với seeding đúng.",
      r3Assigned: "Đã phân vòng 3",
      r3AssignedDesc: "Các VĐV đã được phân vào vòng tiếp theo.",
      cancel: "Hủy",
      save: "Lưu",
      saveGameN: "Lưu G",
    },
  },
  news: {
    title: "Tin tức Pickleball",
    subtitle: "Tổng hợp nhanh các cập nhật pickleball từ nguồn uy tín.",
    noNews: "Chưa có cập nhật. Tin tức sẽ hiển thị tại đây khi có nội dung mới.",
    readMore: "Đọc thêm",
  },
  seo: {
    tools: {
      title: "Công cụ Tổ chức Giải Pickleball",
      description: "Trang Tools cung cấp bộ công cụ tổ chức giải pickleball chuyên nghiệp. Hỗ trợ nhiều hình thức thi đấu khác nhau. Giúp BTC tổ chức giải nhanh, dễ và hạn chế sai sót. Phù hợp cho giải phong trào, CLB và bán chuyên.",
      formatsTitle: "Các Thể thức Được Hỗ trợ",
      quickBracket: "Chia bảng nhanh – Vòng tròn tính điểm + Playoff cho giải phong trào",
      teamMatch: "Đồng đội MLP – Thi đấu theo đội kiểu Major League Pickleball",
      singleElimination: "Single Elimination – Loại trực tiếp, thua 1 trận bị loại",
      doublesElimination: "Loại Kép – Thua 2 trận mới bị loại, công bằng hơn cho VĐV",
      flexTournament: "Flex Tournament – Tự tạo giải đấu theo cách riêng, không giới hạn luật",
    },
    doublesElimination: {
      title: "Doubles Elimination – Thua 2 Trận Mới Bị Loại",
      description: "Thể thức loại kép giúp tăng tính công bằng cho giải đấu. Thua 1 trận → xuống nhánh thua. Thua trận thứ 2 → bị loại. Nhánh thắng và nhánh thua gặp nhau trước chung kết.",
      whenToUseTitle: "Khi nào nên dùng Loại Kép?",
      whenToUseDesc: "Phù hợp cho giải đấu quy mô vừa đến lớn, các sự kiện cạnh tranh hoặc bán chuyên, khi các đội xứng đáng có cơ hội thứ hai để chứng minh năng lực.",
      sizeTitle: "Quy mô Giải đề xuất",
      sizeDesc: "Số đội tối thiểu: 32. Các quy mô đề xuất: 32, 40, 48, 64, 80, 96, 128 đội để bracket cân đối.",
    },
    flexTournament: {
      title: "Flex Tournament – Tự Tạo Giải Đấu Theo Cách Của Bạn",
      description: "Thể thức giải do người dùng tự tạo. Không giới hạn luật hay cấu trúc. Toàn quyền sắp xếp VĐV, đội, bảng, trận đấu. Phù hợp cho giải sáng tạo hoặc thử nghiệm.",
      differenceTitle: "Điểm khác biệt của Flex Tournament",
      differenceList: [
        "Không ràng buộc logic bracket cố định",
        "Linh hoạt tối đa về cấu trúc giải",
        "BTC toàn quyền kiểm soát",
        "Hỗ trợ thống kê tùy chỉnh",
      ],
      whoTitle: "Ai nên dùng Flex Tournament?",
      whoDesc: "Dành cho BTC CLB, giải đấu tập luyện, thể thức đặc biệt, các giải có luật riêng hoặc sáng tạo.",
    },
  },
  referee: {
    title: "Trọng tài",
    emailPlaceholder: "Nhập email trọng tài",
    addBtn: "Thêm",
    emptyState: "Chưa có trọng tài nào. Thêm trọng tài để họ có thể nhập điểm.",
    noName: "Không có tên",
    removeBtn: "Gỡ",
    description: "Trọng tài có thể nhập và sửa điểm tất cả các trận trong giải.",
    loading: "Đang tải...",
  },
  teamMatchComponents: {
    statusPending: "Chờ duyệt",
    statusApproved: "Đã duyệt",
    statusRejected: "Từ chối",
    yourTeam: "Đội của bạn",
    youAreCaptain: "Bạn là đội trưởng của đội này",
    members: "Thành viên",
    rosterFull: "Đủ đội",
    rosterIncomplete: "Chưa đủ",
    memberList: "Danh sách thành viên:",
    male: "Nam",
    female: "Nữ",
    manageTeam: "Quản lý đội",
    manageAsOrganizer: "Quản lý đội hình với quyền BTC",
    viewTeamInfo: "Xem thông tin đội",
    noTeams: "Chưa có đội nào",
    deleteTeamTitle: "Xóa đội?",
    deleteTeamDesc: "Bạn có chắc muốn xóa đội \"{name}\"? Hành động này không thể hoàn tác.",
    cancelBtn: "Hủy",
    deleteBtn: "Xóa",
    teamListTitle: "Danh sách đội",
    registeredTeams: "Giải đấu có {count} đội đã đăng ký",
    rosterStatus: "Trạng thái",
    lineupDone: "Đã line up",
    noMatchesInGroup: "Chưa có trận đấu trong",
    noMatchesCreateSchedule: "Chia bảng để tạo lịch thi đấu",
    noGroupsYet: "Chưa chia bảng",
    roundLabel: "Vòng",
    startRound: "Bắt đầu",
    waitingLineup: "Chờ line up",
    missingLineup: "Chưa line up:",
    scoreBtn: "Chấm",
    notStarted: "Chưa bắt đầu",
    liningUp: "Đang line up",
    live: "LIVE",
    ended: "Đã kết thúc",
    createTeamTitle: "Tạo đội mới",
    createTeamDesc: "Đăng ký đội của bạn để tham gia giải đấu. Bạn sẽ là đội trưởng.",
    teamNameLabel: "Tên đội",
    teamNameError: "Tên đội phải có ít nhất 2 ký tự",
    captainNameLabel: "Tên đội trưởng (bạn)",
    captainNameError: "Tên đội trưởng phải có ít nhất 2 ký tự",
    inviteCaptainEmail: "Nhập email đội trưởng để mời đội tham gia giải. Đội sẽ được tự động duyệt.",
    inviteCaptainEmailLabel: "Email đội trưởng",
    inviteDesc: "Mời đội",
    inviteEmailError: "Vui lòng nhập email đội trưởng",
    groupSetupTitle: "Chia bảng thi đấu",
    groupSetupDesc: "Chọn số bảng và xem trước cách chia đội",
  },
  dashboard: {
    title: "Bảng điều khiển trực tiếp",
    description: "Theo dõi trạng thái sân và tỷ số realtime",
    selectTournament: "Chọn giải đấu",
    court: "Sân",
    nowPlaying: "Đang thi đấu",
    nextMatch: "Tiếp theo",
    available: "Trống",
    tvMode: "Chế độ TV",
    exitTvMode: "Thoát chế độ TV",
    soundOn: "Bật âm thanh",
    soundOff: "Tắt âm thanh",
    noActiveTournaments: "Không có giải đang diễn ra",
    vs: "vs",
    match: "Trận",
    score: "Tỷ số",
    quickTable: "Bảng đấu",
    teamMatch: "Đối kháng",
    doublesElimination: "Đấu loại đôi",
    autoRotate: "Tự động xoay",
    liveMatches: "Trận đang đấu",
    upNext: "Sắp thi đấu",
    completed: "Đã hoàn thành",
    backToList: "Quay lại",
  },
  forum: {
    title: "Diễn đàn",
    navLabel: "Diễn đàn",
    createPost: "Tạo bài viết",
    newPost: "Bài viết mới",
    allCategories: "Tất cả",
    trending: "Nổi bật",
    latest: "Mới nhất",
    pinned: "Ghim",
    qa: "Hỏi đáp",
    markAsQA: "Đánh dấu Hỏi đáp",
    bestAnswer: "Câu trả lời hay nhất",
    markBestAnswer: "Chọn câu trả lời hay nhất",
    unmarkBestAnswer: "Bỏ chọn câu trả lời",
    likes: "thích",
    comments: "bình luận",
    noPostsYet: "Chưa có bài viết nào. Hãy là người đầu tiên!",
    noCommentsYet: "Chưa có bình luận. Hãy là người đầu tiên trả lời!",
    writeComment: "Viết bình luận...",
    postTitle: "Tiêu đề",
    postTitlePlaceholder: "Bạn muốn thảo luận về điều gì?",
    postContent: "Nội dung",
    postContentPlaceholder: "Chia sẻ suy nghĩ của bạn...",
    selectCategory: "Chọn danh mục",
    addTags: "Tag",
    addTagsPlaceholder: "Thêm tag và nhấn Enter",
    attachImages: "Đính kèm ảnh",
    maxImages: "Tối đa 4 ảnh",
    publish: "Đăng bài",
    publishing: "Đang đăng...",
    publishSuccess: "Đã đăng bài!",
    deletePost: "Xóa bài viết",
    deletePostConfirm: "Bạn có chắc muốn xóa bài viết này?",
    deleteComment: "Xóa bình luận",
    loginToPost: "Đăng nhập để tạo bài viết",
    loginToComment: "Đăng nhập để bình luận",
    by: "bởi",
    ago: "trước",
    readMore: "Xem thêm",
    backToForum: "Quay lại Diễn đàn",
    pinPost: "Ghim bài",
    unpinPost: "Bỏ ghim",
    editPost: "Sửa bài viết",
    reply: "Trả lời",
    replyingTo: "Đang trả lời",
    cancelReply: "Hủy",
  },
  socialEvents: {
    nav: "Sự kiện",
    breadcrumb: "Sự kiện CLB",
    comingSoon: "Đang xây dựng — sẽ ra mắt cuối tháng 5/2026.",
    detail: {
      registerCta: "Đăng ký ngay",
      registerCtaShort: "Đăng ký",
      registerInProgress: "Sự kiện đang diễn ra",
      registeredCount: "{registered}/{max} người đã đăng ký",
      spotsLeft: "Còn {n} chỗ",
      startsIn: "Bắt đầu sau",
      startedAt: "Đã bắt đầu",
      ended: "Đã kết thúc",
      cancelled: "Sự kiện đã hủy",
      level: "Trình độ",
      free: "Miễn phí",
      priceVnd: "{vnd}₫ / người",
      cancellationPolicy: "Chính sách hủy",
      cancellationPolicyBody:
        "Hủy đăng ký trễ nhất {hours} giờ trước khi sự kiện bắt đầu để được hoàn tiền 100%.",
      hostedBy: "Tổ chức bởi",
      directionsLabel: "Mở Google Maps",
      zaloGroup: "Mở nhóm Zalo",
      shareTitle: "Chia sẻ sự kiện",
      shareCopy: "Sao chép liên kết",
      shareZalo: "Chia sẻ Zalo",
      shareFacebook: "Chia sẻ Facebook",
      copyLink: "Đã sao chép liên kết",
      rosterHeading: "Đã đăng ký",
      rosterEmpty: "Chưa có ai đăng ký — bạn là người đầu tiên!",
      privatePreview: "Sự kiện chưa công khai — chỉ mình bạn (organizer) xem được.",
      notFound: "Không tìm thấy sự kiện",
      notFoundBody:
        "Liên kết có thể đã hết hạn hoặc sự kiện đã bị xóa. Quay lại trang chủ để xem các sự kiện đang diễn ra.",
    },
    register: {
      modalTitle: "Đăng ký sự kiện",
      stepPhone: "Số điện thoại",
      stepCode: "Nhập mã OTP",
      stepPayment: "Thanh toán",
      stepDone: "Hoàn tất",
      phoneLabel: "Số điện thoại",
      phonePlaceholder: "0901 234 567",
      phoneInvalid: "Số điện thoại không hợp lệ",
      nameLabel: "Tên hiển thị",
      namePlaceholder: "Nguyễn Văn A",
      nameRequired: "Vui lòng nhập tên",
      levelLabel: "Trình độ tự đánh giá (tuỳ chọn)",
      levelOptional: "Chưa rõ",
      sendOtp: "Gửi mã OTP",
      otpLabel: "Mã OTP 6 chữ số",
      otpHint: "Đã gửi mã tới {phone}. Mã hết hạn sau 5 phút.",
      otpHintZalo:
        "Đã gửi mã qua Zalo đến {phone}. Mở app Zalo, kiểm tra tin nhắn từ ThePickleHub OA. Mã hết hạn sau 5 phút.",
      otpHintSms:
        "Đã gửi mã qua SMS đến {phone}. Mã hết hạn sau 5 phút.",
      otpResend: "Gửi lại mã",
      otpResendIn: "Gửi lại sau {seconds}s",
      otpResendViaSms: "Không nhận được Zalo? Gửi lại qua SMS →",
      otpInvalid: "Mã OTP không đúng",
      otpExpired: "Mã OTP đã hết hạn — vui lòng yêu cầu mã mới",
      tooManyAttempts: "Sai mã quá nhiều lần — vui lòng yêu cầu mã mới",
      tooManyOtps: "Bạn đã yêu cầu OTP quá nhiều lần — thử lại sau 15 phút",
      alreadyRegistered: "Số điện thoại này đã đăng ký sự kiện",
      eventFull: "Sự kiện đã đủ người",
      eventNotOpen: "Sự kiện không mở đăng ký",
      smsFailed: "Không gửi được SMS — vui lòng thử lại hoặc liên hệ ban tổ chức",
      networkError: "Lỗi kết nối — vui lòng thử lại",
      submit: "Xác nhận đăng ký",
      submitting: "Đang xử lý…",
      successTitle: "Đăng ký thành công!",
      successBody: "Hẹn gặp bạn tại sân. Hãy lưu lại liên kết này.",
      successPaymentBody:
        "Vui lòng chuyển khoản {price}₫ cho ban tổ chức. Trạng thái thanh toán sẽ cập nhật sau khi xác nhận.",
      orderLabel: "Số thứ tự đăng ký",
      paymentInstructions: "Hướng dẫn thanh toán",
      openZalo: "Mở nhóm Zalo",
      backToEvent: "Quay lại sự kiện",
      // Slot picker
      slotPickerLabel: "Chọn nhóm chơi",
      slotPickerHint:
        "BTC chia event thành nhiều nhóm theo trình độ hoặc thời gian chơi. Vui lòng chọn nhóm phù hợp với bạn.",
      slotMetaSkill: "Trình độ",
      slotMetaDurationMonths: "Đã chơi tối thiểu {n} tháng",
      slotMetaDurationNewbie: "Người mới bắt đầu",
      slotMetaCourts: "{n} sân",
      slotRemainingBadge: "Còn {remaining}/{capacity} chỗ",
      slotFullBadge: "Đã đầy",
      slotRequired: "Vui lòng chọn 1 nhóm chơi để tiếp tục",
      slotInvalid: "Nhóm chơi không hợp lệ — vui lòng tải lại trang",
      slotFull: "Nhóm này đã đầy — vui lòng chọn nhóm khác",
    },
    proxyRegister: {
      proxyRegisterCta: "Đăng ký hộ bạn bè",
      manualAddCta: "Thêm người thủ công",
      modalHeading: "Đăng ký hộ bạn bè",
      modalSubheading: "Đăng ký giúp người chơi khác tham gia event này.",
      manualModalHeading: "Thêm người chơi vào sự kiện",
      manualModalSubheading:
        "Sử dụng khi bạn nhận đăng ký qua Zalo, gọi điện hoặc kênh ngoài web.",
      guestSectionHeading: "Thông tin người được đăng ký",
      playerSectionHeading: "Thông tin người chơi",
      guestPhoneLabel: "Số điện thoại",
      guestNameLabel: "Tên hiển thị",
      guestLevelLabel: "Trình độ (tuỳ chọn)",
      guestLevelHint: "Tự đánh giá level pickleball",
      paymentStatusLabel: "Trạng thái thanh toán",
      paymentStatusUnpaid:
        "Chưa thanh toán — hiển thị link để gửi player tự chuyển khoản",
      paymentStatusClaimedPaid: "Đã thanh toán tại sân / chuyển khoản",
      paymentStatusWaived: "Miễn phí (bỏ qua)",
      internalNotesLabel: "Ghi chú nội bộ (tuỳ chọn)",
      internalNotesHint: "Chỉ BTC xem được",
      internalNotesPlaceholder: "VD: VIP, bạn của BTC",
      proxyConfirmCta: "Xác nhận đăng ký hộ",
      manualConfirmCta: "Thêm vào danh sách",
      paymentWarningProxy:
        "Người được đăng ký hộ tự chuyển khoản hoặc bạn chuyển hộ. Mã thanh toán sẽ hiển thị sau khi đăng ký xong.",
      prepaymentSkipWarning:
        "Bạn đã đăng ký giúp {name}. Đây là sự kiện bắt buộc thanh toán trước nên slot sẽ tự động bị huỷ sau {hours} giờ nếu không hoàn tất chuyển khoản.",
      successHeading: "Đã thêm {name} vào sự kiện",
      shareWarning:
        "Vui lòng gửi link sau cho {name} để họ tự quản lý đăng ký hoặc thanh toán (nếu event có phí):",
      shareLinkHeading: "Link quản lý đăng ký của {name}",
      copyLinkLabel: "Sao chép link",
      copyLinkSuccess: "Đã sao chép link",
      shareZaloLabel: "Chia sẻ Zalo",
      shareFacebookLabel: "Chia sẻ Facebook",
      copyPaymentInfoLabel: "Sao chép thông tin chuyển khoản",
      copyPaymentInfoSuccess: "Đã sao chép thông tin chuyển khoản",
      addAnotherCta: "+ Thêm người khác",
      closeCta: "Đóng",
      errorAlreadyRegistered: "SĐT này đã đăng ký event",
      errorEventFull: "Sự kiện đã đầy",
      errorRateLimitProxy: "Bạn đã đăng ký hộ tối đa 5 người/24h",
      errorRateLimitManual: "Đã đạt giới hạn 50 lượt thêm/24h",
      errorUnauthorized: "Bạn không có quyền thêm người vào sự kiện này",
      proxyBadgeLabel: "đăng ký hộ",
      manualBadgeLabel: "BTC thêm",
    },
    club: {
      upcomingHeading: "Sự kiện sắp diễn ra",
      pastHeading: "Sự kiện đã qua",
      noUpcoming: "Chưa có sự kiện nào — quay lại sau nhé!",
      eventsLabel: "{n} sự kiện",
      notFound: "Không tìm thấy CLB",
      notFoundBody:
        "Liên kết CLB có thể đã thay đổi hoặc bị xóa. Quay lại trang chủ để khám phá thêm.",
      manageEventCta: "Quản lý",
      archivedHeading: "CLB này đã ngừng hoạt động",
      archivedBody:
        "CLB không nhận đăng ký event mới. Bạn có thể xem các sự kiện cũ; liên hệ admin nếu cần thông tin thêm.",
    },
    create: {
      pageTitle: "Tạo sự kiện mới",
      pageSubtitle: "Sự kiện sẽ xuất hiện trên trang CLB sau khi xuất bản.",
      titleVi: "Tên sự kiện (tiếng Việt)",
      titleEn: "Tên sự kiện (English, tuỳ chọn)",
      titleViPlaceholder: "Open Play Tối Thứ Bảy",
      titleEnPlaceholder: "Saturday Night Open Play",
      slug: "Đường dẫn (slug)",
      slugHint:
        "Hiển thị trong URL: thepicklehub.net/social/<slug>. Chỉ chữ thường, số và dấu gạch ngang.",
      slugAuto: "Tự sinh từ tên",
      descriptionVi: "Mô tả (tiếng Việt)",
      descriptionEn: "Mô tả (English, tuỳ chọn)",
      startAt: "Bắt đầu",
      endAt: "Kết thúc",
      location: "Địa điểm",
      locationPlaceholder: "Sân pickleball ABC, Quận 3, TP.HCM",
      latLng: "Toạ độ (lat,lng — tuỳ chọn)",
      courtCount: "Số sân",
      maxPlayers: "Số người tối đa",
      levelMin: "Trình độ tối thiểu",
      levelMax: "Trình độ tối đa",
      priceVnd: "Phí mỗi người (VNĐ)",
      priceVndHint: "Đặt 0 cho sự kiện miễn phí.",
      allowGuests: "Cho phép đăng ký khách (qua OTP)",
      allowGuestsHint:
        "Bỏ chọn nếu chỉ thành viên CLB có tài khoản mới được đăng ký.",
      cancellationHours: "Số giờ hủy đăng ký được hoàn tiền",
      zaloGroupUrl: "Liên kết nhóm Zalo (tuỳ chọn)",
      visibility: "Hiển thị",
      visibilityPublic: "Công khai — ai cũng xem được",
      visibilityClubOnly: "Chỉ trong CLB — không index search engine",
      saveDraft: "Lưu nháp",
      publishNow: "Xuất bản ngay",
      submitting: "Đang lưu…",
      errorRequired: "Trường này bắt buộc",
      errorTimeOrder: "Giờ kết thúc phải sau giờ bắt đầu",
      errorSlugTaken: "Slug đã tồn tại — vui lòng đổi",
      errorSlugFormat: "Slug chỉ chứa chữ thường, số, dấu gạch ngang (3–100 ký tự)",
      successDraft: "Đã lưu nháp",
      successPublished: "Đã xuất bản — sự kiện đang nhận đăng ký",
      stepIndicator: "Bước {n}/2",
      step1Heading: "Thông tin sự kiện",
      step1Subheading: "Nhập chi tiết cơ bản về buổi chơi của bạn.",
      step2Heading: "Phí tham gia",
      nextButton: "Tiếp theo →",
      backButton: "← Quay lại",
      eventName: "Tên sự kiện",
      eventNamePlaceholder: "VD: Open Play Tối Thứ Bảy",
      description: "Mô tả",
      startDate: "Ngày bắt đầu",
      startTime: "Giờ bắt đầu",
      endTime: "Giờ kết thúc",
      priceAmount: "Số tiền (VND)",
      priceFreeHint: "Nhập 0 nếu sự kiện miễn phí.",
      paymentBannerFree:
        "Sự kiện miễn phí. Người chơi sẽ không thấy bước thanh toán.",
      paymentBannerNotConfigured:
        "CLB chưa bật thanh toán online. Người chơi sẽ thấy thông báo \"Vui lòng thanh toán tại sân cho BTC\".",
      paymentBannerNotConfiguredCta: "Cài đặt thanh toán online →",
      paymentBannerReady:
        "Người chơi sẽ thấy QR VietQR + thông tin chuyển khoản khi đăng ký. Tiền chuyển trực tiếp vào tài khoản CLB.",
      errorTitleMin: "Tên sự kiện cần ít nhất 3 ký tự",
      errorTitleMax: "Tên sự kiện không quá 200 ký tự",
      errorLocationMin: "Địa điểm cần ít nhất 3 ký tự",
      errorPastDate: "Ngày bắt đầu không được trong quá khứ",
      errorMaxPlayersMin: "Cần tối thiểu 4 người chơi",
      errorCourtCountMin: "Số sân phải lớn hơn 0",
      errorZaloUrl: "Liên kết Zalo không hợp lệ",
      errorPriceTooLarge: "Phí tham gia tối đa 10.000.000 ₫",
      errorPriceNeg: "Phí không được âm",
      step2PaymentHeading: "Cài đặt thanh toán",
      bankInfoHeading: "Thông tin nhận thanh toán",
      bankLabel: "Ngân hàng",
      bankPlaceholder: "Chọn ngân hàng",
      accountNumberLabel: "Số tài khoản",
      accountNumberPlaceholder: "0123456789",
      accountNameLabel: "Tên chủ tài khoản",
      accountNameHint: "Viết hoa không dấu, đúng như trên ngân hàng (vd: NGUYEN VAN A).",
      bankDisclaimer:
        "Tiền sẽ chuyển trực tiếp vào tài khoản này. ThePickleHub không cầm tiền. Mỗi event có thể dùng STK khác nhau (BTC khác nhau).",
      previewLabel: "Preview QR",
      previewAlt: "Mã VietQR preview",
      errorAccountNumber: "Số tài khoản phải là 6–20 chữ số.",
      errorAccountName: "Tên chủ tài khoản tối thiểu 3 ký tự, không chứa số.",
      requirePrepayment: "Bắt buộc chuyển khoản trước",
      requirePrepaymentDescription:
        "Player phải hoàn tất chuyển khoản trong thời gian quy định, nếu không đăng ký sẽ tự động bị huỷ.",
      paymentDeadlineHours: "Thời hạn thanh toán (giờ)",
      paymentDeadlineHint:
        "Tính từ lúc player đăng ký. Nếu thời hạn vượt qua giờ bắt đầu event, đăng ký bị huỷ ngay.",
      errorPrepaymentDeadlineRange: "Thời hạn phải trong khoảng 1–168 giờ (tối đa 1 tuần).",
      repeatWeeksLabel: "Lặp lại hàng tuần (tuỳ chọn)",
      repeatWeeksUnit: "tuần liên tiếp sau",
      repeatWeeksHint: "Nhập 0 để tạo 1 event duy nhất. Nhập 1 = tạo thêm 1 event vào tuần kế tiếp; nhập 4 = tạo thêm 4 event cách nhau 7 ngày. Tối đa 12.",
      repeatWeeksPreview: "→ Sẽ tạo {count} event giống hệt, event cuối cùng vào {last}.",
      errorRepeatWeeksRange: "Số tuần lặp phải từ 0 đến 12.",
      bulkCreatedToast: "Đã tạo {count} event giống hệt.",
      // Slots
      slotsHeading: "Nhóm đăng ký (tuỳ chọn)",
      slotsSubheading:
        "Chia event thành nhiều nhóm theo trình độ hoặc thời gian chơi. Player sẽ chọn 1 nhóm khi đăng ký.",
      slotsEmptyHint:
        "Chưa có nhóm — player đăng ký vào pool chung (giới hạn ở số người tối đa bên trên).",
      slotsTotalCapacity: "Tổng chỗ trong nhóm: {total}/{max}",
      slotAddSkill: "Thêm nhóm theo trình độ",
      slotAddDuration: "Thêm nhóm theo thời gian chơi",
      slotAddGeneral: "Thêm nhóm khác",
      slotKindSkill: "Trình độ",
      slotKindDuration: "Thời gian chơi",
      slotKindGeneral: "Khác",
      slotLabel: "Tên nhóm",
      slotLabelPlaceholderSkill: "VD: Sân 1-2: Trình độ 2.5",
      slotLabelPlaceholderDuration: "VD: Người mới chơi 6 tháng+",
      slotLabelPlaceholderGeneral: "VD: Sân nâng cao",
      slotCapacity: "Số chỗ",
      slotSkillLevel: "Trình độ",
      slotSkillChoose: "Chọn trình độ",
      slotSkillNewbie: "Newbie (mới chơi)",
      slotCourtCount: "Số sân (tuỳ chọn)",
      slotMinPlayMonths: "Thời gian chơi tối thiểu",
      slotDurationChoose: "Chọn thời gian",
      slotDurationLT3: "Người mới (dưới 3 tháng)",
      slotDuration3: "Đã chơi 3 tháng+",
      slotDuration6: "Đã chơi 6 tháng+",
      slotDuration12: "Đã chơi 1 năm+",
      slotDuration24: "Đã chơi 2 năm+",
      slotDuration36: "Đã chơi 3 năm+",
      slotNotes: "Ghi chú (tuỳ chọn)",
      slotNotesPlaceholder: "VD: Đem giày sân cứng, đi giờ A",
      slotRemoveAria: "Xoá nhóm",
      errorSlotLabelMin: "Tên nhóm cần ít nhất 2 ký tự",
      errorSlotLabelMax: "Tên nhóm tối đa 80 ký tự",
      errorSlotCapacityMin: "Số chỗ trong nhóm tối thiểu 1",
      errorSlotCapacityMax: "Số chỗ trong nhóm tối đa 200",
      errorSlotSkillRequired: "Vui lòng chọn trình độ cho nhóm",
      errorSlotDurationRange: "Vui lòng chọn thời gian chơi cho nhóm",
      errorSlotsExceedMaxPlayers:
        "Tổng số chỗ trong các nhóm ({total}) đang vượt số người tối đa ({max}). Giảm bớt hoặc tăng số người tối đa.",
      errorSlotTooMany: "Tối đa 12 nhóm cho 1 event",
      errorSlotDuplicateId: "Nhóm bị trùng id — vui lòng xoá và tạo lại",
    },
    manage: {
      pageTitle: "Quản lý sự kiện",
      newEventCta: "Tạo sự kiện mới",
      backToClub: "Quay lại trang CLB",
      noEvents: "CLB chưa có sự kiện nào.",
      emptyHeading: "Tạo sự kiện đầu tiên",
      emptyBody:
        "CLB đã sẵn sàng. Hãy tạo sự kiện đầu tiên để bắt đầu mời người chơi và quản lý lịch thi đấu.",
      emptyCta: "Tạo sự kiện đầu tiên",
      statsRegistered: "Đăng ký",
      statsPaid: "Đã thanh toán",
      statsCheckedIn: "Check-in",
      statusDraft: "Nháp",
      statusPublished: "Đang nhận đăng ký",
      statusCancelled: "Đã huỷ",
      statusCompleted: "Đã kết thúc",
      manageRoster: "Danh sách đăng ký",
      shufflePairs: "Xếp cặp",
      editEvent: "Sửa event",
      viewPublic: "Xem trang công khai",
      cancelEvent: "Huỷ sự kiện",
      cancelEventConfirm: "Bạn chắc chắn huỷ sự kiện này?",
      cancelEventConfirmBody:
        "Tất cả người đã đăng ký sẽ thấy thông báo \"Sự kiện đã huỷ\". Bạn có thể mở lại sau.",
      cancelled: "Đã huỷ",
      reopen: "Mở lại",
      reopenedToast: "Đã mở lại sự kiện",
      noPermissionTitle: "Bạn không có quyền truy cập",
      noPermissionBody:
        "Chỉ tổ chức viên (người tạo CLB hoặc admin) mới truy cập được trang này.",
    },
    clubsList: {
      pageTitle: "Danh sách CLB",
      kicker: "Câu lạc bộ",
      heading: "Khám phá CLB pickleball",
      subheading: "Tìm CLB gần bạn, theo dõi sự kiện sắp tới, hoặc tạo CLB của riêng bạn.",
      searchPlaceholder: "Tìm theo tên hoặc địa điểm…",
      searchAria: "Tìm CLB theo tên hoặc địa điểm",
      createCta: "Tạo CLB",
      createCtaAnon: "Đăng nhập để tạo CLB",
      emptyAll: "Chưa có CLB nào. Hãy là người tạo CLB đầu tiên!",
      emptySearch: "Không tìm thấy CLB phù hợp. Thử từ khoá khác.",
      cardCta: "Xem CLB",
      cardEventCount: "{n} sự kiện sắp tới",
      cardNoEvents: "Chưa có sự kiện",
      cardCreatedBy: "Tạo bởi {name}",
      sectionMine: "CLB của tôi",
      sectionAll: "Tất cả CLB",
    },
    createClub: {
      pageTitle: "Tạo CLB mới",
      kicker: "Câu lạc bộ",
      heading: "Tạo CLB của bạn",
      nameLabel: "Tên CLB",
      namePlaceholder: "VD: CLB Pickleball Sài Gòn",
      nameInvalid: "Tên CLB cần 3–100 ký tự.",
      slugLabel: "Slug (URL)",
      slugAuto: "Tự động",
      slugHint:
        "URL của CLB sẽ là thepicklehub.net/clb/<slug>. Chỉ chữ thường, số và dấu gạch ngang.",
      slugInvalid: "Slug cần 3–50 ký tự, chỉ chữ thường / số / gạch ngang.",
      slugChecking: "Đang kiểm tra…",
      slugTaken: "Slug này đã được sử dụng. Hãy chọn slug khác.",
      slugAvailable: "✓ Slug khả dụng",
      descriptionLabel: "Mô tả ngắn",
      descriptionPlaceholder: "Giới thiệu về CLB, đối tượng người chơi, lịch sinh hoạt…",
      locationLabel: "Địa điểm",
      locationPlaceholder: "VD: Quận 7, TP. HCM",
      locationHint: "Hiển thị trên trang CLB và danh sách CLB.",
      logoLabel: "Logo CLB",
      logoUpload: "Tải lên",
      logoRemove: "Xoá",
      logoHint: "JPG / PNG / WebP, tối đa 2MB. Hình vuông sẽ đẹp nhất.",
      logoUploadError: "Tải logo thất bại",
      logoTooLargeTitle: "Tệp quá lớn",
      logoTooLargeBody: "Logo tối đa 2MB. Hãy chọn tệp nhỏ hơn.",
      submit: "Tạo CLB",
      submitting: "Đang tạo CLB…",
      infoBanner:
        "Mỗi tài khoản tối đa {max} CLB. Bạn là chủ CLB và có thể tạo sự kiện ngay sau khi tạo.",
      tooManyClubsTitle: "Đã đạt giới hạn CLB",
      tooManyClubsBody:
        "Mỗi tài khoản chỉ tạo được tối đa {max} CLB. Hãy liên hệ admin nếu cần thêm.",
      successTitle: "Đã tạo CLB",
      successBody: "Chuyển đến trang quản lý CLB…",
      backToList: "Quay lại danh sách CLB",
    },
    playerRegistration: {
      pageTitle: "Đăng ký của bạn",
      eyebrow: "Đăng ký của bạn",
      viewPublic: "Xem trang sự kiện",
      statusActive: "Đã đăng ký",
      statusCancelled: "Đã huỷ",
      labelName: "Tên",
      labelWhen: "Thời gian",
      labelWhere: "Địa điểm",
      labelPrice: "Phí",
      labelCancelledAt: "Huỷ lúc",
      labelCancelledReason: "Lý do",
      priceFree: "Miễn phí",
      paymentHeading: "Mã thanh toán",
      paymentMarked: "Bạn đã đánh dấu đã chuyển khoản.",
      paymentPending: "Bạn chưa đánh dấu đã chuyển khoản.",
      cancellationPolicyHeading: "Chính sách hoàn tiền",
      refundEligible:
        "Hủy trước {h} giờ so với giờ bắt đầu sự kiện — bạn được hoàn 100% (do BTC tự xử lý).",
      refundIneligible:
        "Còn dưới {h} giờ — theo chính sách, BTC có quyền không hoàn tiền.",
      refundManualNote:
        "ThePickleHub không cầm tiền; mọi việc hoàn tiền do BTC xử lý thủ công.",
      cancelCta: "Hủy đăng ký",
      cancelModalTitle: "Xác nhận hủy đăng ký",
      cancelModalBody:
        "Bạn chắc chắn muốn hủy đăng ký? Slot sẽ được mở lại cho người khác.",
      cancelReasonLabel: "Lý do (tuỳ chọn)",
      cancelReasonPlaceholder: "VD: Bận công việc, ốm…",
      cancelConfirmCta: "Xác nhận hủy",
      cancelling: "Đang hủy…",
      modalBack: "Quay lại",
      cancelSuccessTitle: "Đã hủy đăng ký",
      cancelSuccessBody: "Slot đã được mở lại. Bạn có thể đăng ký lại nếu đổi ý.",
      reactivateCta: "Đăng ký lại",
      reactivating: "Đang đăng ký lại…",
      reactivateSuccessTitle: "Đã đăng ký lại",
      reactivateSuccessBody: "Bạn đã có lại slot. Hẹn gặp tại sự kiện!",
      eventStartedHint: "Sự kiện đã bắt đầu, không thể huỷ/đăng ký lại.",
      eventFullHint: "Sự kiện đã đầy. Bạn không thể đăng ký lại.",
      eventCancelledTitle: "Sự kiện đã bị BTC hủy",
      eventCancelledBody:
        "BTC đã hủy sự kiện này. Đăng ký của bạn coi như đã huỷ. Hãy liên hệ BTC để biết thông tin hoàn tiền (nếu có).",
      referenceCodeCopied: "Đã sao chép mã",
      notFoundTitle: "Không tìm thấy đăng ký",
      notFoundBody:
        "Link bạn đang dùng không hợp lệ hoặc đã hết hạn. Liên hệ BTC nếu bạn cần xác nhận đăng ký.",
      saveLinkHeading: "Link quản lý đăng ký của bạn",
      saveLinkBody:
        "Bookmark hoặc lưu lại link này — bạn cần nó để xem trạng thái hoặc huỷ đăng ký. (Không gửi SMS / email.)",
      saveLinkCopy: "Sao chép",
      saveLinkCopied: "Đã sao chép link",
      saveLinkOpen: "Mở tab mới",
      saveLinkScreenshotHint:
        "Khuyên: chụp màn hình thẻ này — link không thể khôi phục nếu mất.",
      alreadyRegisteredBanner: "Bạn đã đăng ký sự kiện này",
      alreadyRegisteredCta: "Xem đăng ký của bạn",
      cancelledBanner: "Bạn đã huỷ đăng ký sự kiện này",
      reregisterCta: "Quản lý / Đăng ký lại",
      unpaidRegistrationBannerTitle: "Đăng ký chưa thanh toán",
      unpaidRegistrationBannerDescription:
        "Sự kiện này yêu cầu chuyển khoản trước. Hoàn tất chuyển khoản theo mã thanh toán bên dưới rồi bấm \"Đã thanh toán\" để xác nhận.",
      timeRemaining: "Còn lại: {hours} giờ {minutes} phút",
      paymentOverdue: "Đã quá hạn thanh toán, đăng ký sẽ sớm bị huỷ.",
      payNowButton: "Tôi đã chuyển tiền",
      payNowConfirmPrompt:
        "Chỉ xác nhận khi bạn đã thực sự chuyển khoản. BTC sẽ đối chiếu với mã thanh toán.",
      payNowConfirm: "Xác nhận đã chuyển",
      payNowCancel: "Huỷ",
      payNowSuccess: "Đã đánh dấu đã thanh toán. BTC sẽ xác nhận.",
      errors: {
        generic: "Có lỗi xảy ra, vui lòng thử lại.",
        invalid_magic_token: "Link không hợp lệ.",
        not_found: "Không tìm thấy đăng ký.",
        registration_missing: "Không tìm thấy đăng ký.",
        event_missing: "Không tìm thấy sự kiện.",
        event_started: "Sự kiện đã bắt đầu, không thể huỷ.",
        event_cancelled: "Sự kiện đã bị BTC hủy.",
        event_completed: "Sự kiện đã kết thúc.",
        event_not_open: "Sự kiện không mở đăng ký.",
        event_full: "Sự kiện đã đầy, vui lòng đăng ký event khác.",
        already_cancelled: "Đăng ký đã được hủy trước đó.",
        update_failed: "Không cập nhật được, vui lòng thử lại.",
        lookup_failed: "Không tải được dữ liệu, vui lòng thử lại.",
      },
    },
    recovery: {
      pageTitle: "Khôi phục đăng ký",
      eyebrow: "Khôi phục đăng ký",
      heading: "Tìm lại đăng ký của bạn",
      subheading: "Nhập số điện thoại đã dùng đăng ký event. Hệ thống sẽ gửi link qua Zalo OA hoặc email — hoặc giải CAPTCHA để mở link trực tiếp.",
      phoneLabel: "Số điện thoại",
      phoneInvalid: "Số điện thoại không hợp lệ.",
      submit: "Tìm đăng ký",
      submitting: "Đang tìm…",
      zaloSentTitle: "Đã gửi qua Zalo",
      zaloSentBody:
        "Tìm thấy {n} đăng ký. Link đã gửi vào tin nhắn Zalo OA của bạn — kiểm tra app Zalo.",
      emailSentTitle: "Đã gửi qua email",
      emailSentBody:
        "Tìm thấy {n} đăng ký. Link đã gửi tới {email}. Kiểm tra inbox (và mục spam).",
      captchaTitle: "Xác minh bạn không phải bot",
      captchaBody:
        "Bạn chưa có Zalo OA hoặc email recovery. Giải CAPTCHA để mở link đăng ký trực tiếp.",
      captchaSubmit: "Xác minh",
      captchaVerifying: "Đang xác minh…",
      captchaSuccessTitle: "Đã xác minh",
      captchaSuccessBody: "Mở link đăng ký của bạn:",
      captchaOpenCta: "Mở trang đăng ký",
      noRegistration: "Chưa đăng ký?",
      noRegistrationCta: "Khám phá CLB pickleball",
      lostLinkHint: "Đã đăng ký nhưng mất link?",
      lostLinkCta: "Khôi phục",
      errors: {
        generic: "Có lỗi xảy ra, vui lòng thử lại.",
        invalid_phone: "Số điện thoại không hợp lệ.",
        no_registration_found:
          "Không tìm thấy đăng ký với số điện thoại này. Kiểm tra lại hoặc đăng ký event mới.",
        rate_limit_exceeded:
          "Bạn đã gửi quá nhiều yêu cầu. Thử lại sau 24h.",
        captcha_failed: "CAPTCHA không hợp lệ. Thử lại.",
        captcha_required: "Vui lòng giải CAPTCHA bên dưới.",
      },
    },
    recoveryOptIn: {
      heading: "Phòng khi mất link",
      body:
        "Lưu email (hoặc theo dõi Zalo OA) để có thể khôi phục link đăng ký nếu mất.",
      emailLabel: "Email recovery (tuỳ chọn)",
      saveCta: "Lưu email",
      skipCta: "Bỏ qua",
      saveSuccess: "Đã lưu email recovery",
      saveError: "Không lưu được email",
      zaloHint:
        "💡 Hoặc theo dõi ThePickleHub trên Zalo OA để nhận link recovery qua Zalo.",
    },
    entityNotFound: {
      club: {
        title: "Không tìm thấy CLB",
        body: "CLB này có thể đã bị lưu trữ hoặc liên kết bạn dùng đã thay đổi. Hãy thử tìm trong danh sách CLB.",
        backCta: "Xem danh sách CLB",
      },
      event: {
        title: "Không tìm thấy sự kiện",
        body: "Sự kiện này có thể đã bị huỷ hoặc liên kết không còn chính xác. Hãy thử trang sự kiện công khai.",
        backCta: "Xem sự kiện sắp tới",
      },
      profile: {
        title: "Không tìm thấy người chơi",
        body: "Hồ sơ này có thể đã bị xoá hoặc liên kết không đúng.",
        backCta: "Về trang chủ",
      },
    },
    editEvent: {
      pageTitle: "Sửa sự kiện",
      eyebrow: "Sửa sự kiện",
      slugLabel: "URL sự kiện",
      slugImmutableHint: "URL được khóa để giữ liên kết ổn định.",
      titleLabel: "Tên sự kiện",
      descriptionLabel: "Mô tả",
      dateLabel: "Ngày",
      startTimeLabel: "Giờ bắt đầu",
      endTimeLabel: "Giờ kết thúc",
      locationLabel: "Địa điểm",
      courtCountLabel: "Số sân",
      maxPlayersLabel: "Số người tối đa",
      maxPlayersFloor: "không thể giảm dưới {n} (đã đăng ký)",
      errorMaxPlayersBelowReg:
        "Đã có {n} người đăng ký — số người tối đa không được nhỏ hơn.",
      zaloLabel: "Link Zalo group",
      visibilityLabel: "Hiển thị",
      visibilityPublic: "Công khai",
      visibilityClubOnly: "Chỉ thành viên",
      paymentHeading: "Thanh toán",
      priceLabel: "Phí tham gia (VND)",
      priceLockedByClaims:
        "Đã có người đánh dấu đã chuyển khoản — không thể đổi phí.",
      bankWarning:
        "⚠️ Đổi thông tin ngân hàng sẽ ảnh hưởng player đã claim. Cân nhắc kỹ trước khi đổi.",
      bankCodeLabel: "Mã ngân hàng",
      bankAccountNumberLabel: "Số tài khoản",
      bankAccountNameLabel: "Tên chủ TK",
      save: "Lưu thay đổi",
      saving: "Đang lưu…",
      cancelBtn: "Huỷ",
      savedTitle: "Đã lưu",
      savedBody: "Hãy thông báo cho player đã đăng ký qua Zalo group.",
      savedPartialTitle: "Đã lưu thông tin sự kiện",
      savedPartialBody:
        "Nhưng không cập nhật được thông tin ngân hàng. Vui lòng thử lại.",
      activeRegsWarning:
        "⚠️ Sự kiện đã có {n} người đăng ký. Mọi thay đổi sẽ ảnh hưởng đến họ — hãy báo lại qua Zalo sau khi lưu.",
      readOnlyStartedTitle: "Sự kiện đã bắt đầu",
      readOnlyStartedBody:
        "Không thể sửa sự kiện sau khi đã bắt đầu. Liên hệ admin nếu cần điều chỉnh.",
      readOnlyCancelledTitle: "Sự kiện đã bị huỷ",
      readOnlyCancelledBody:
        "Sự kiện này đã bị huỷ. Để mở lại, liên hệ admin.",
      dangerZone: "Vùng nguy hiểm",
      cancelEventHeading: "Huỷ sự kiện",
      cancelEventBody:
        "Huỷ sự kiện này sẽ tự động huỷ tất cả đăng ký. Player sẽ thấy banner \"Sự kiện đã bị BTC huỷ\". Bạn phải tự refund tiền cho ai đã chuyển khoản.",
      cancelEventCta: "Huỷ sự kiện",
      cancelEventModalTitle: "Xác nhận huỷ sự kiện",
      cancelEventModalBody:
        "Bạn sắp huỷ sự kiện. {n} đăng ký sẽ bị huỷ tự động.",
      cancelEventModalInputLabel: "Gõ \"{name}\" để xác nhận",
      cancelEventConfirmCta: "Huỷ sự kiện",
      cancelEventCancelling: "Đang huỷ…",
      cancelEventSuccessTitle: "Đã huỷ sự kiện",
      cancelEventSuccessBody: "Tất cả đăng ký đã được tự động huỷ.",
      modalBack: "Quay lại",
    },
    editClub: {
      pageTitle: "Cài đặt CLB",
      slugLabel: "URL CLB",
      slugImmutableHint: "URL được khóa để giữ liên kết ổn định. Liên hệ admin nếu cần đổi.",
      nameLabel: "Tên CLB",
      descriptionLabel: "Mô tả ngắn",
      locationLabel: "Địa điểm",
      logoLabel: "Logo CLB",
      save: "Lưu thay đổi",
      saving: "Đang lưu…",
      cancel: "Huỷ",
      successTitle: "Đã lưu",
      successBody: "Thông tin CLB đã được cập nhật.",
      dangerZone: "Vùng nguy hiểm",
      archiveHeading: "Lưu trữ CLB",
      archiveBody:
        "CLB sẽ bị ẩn khỏi danh sách công khai và menu của bạn. Các sự kiện đã công bố vẫn truy cập được qua liên kết trực tiếp. Liên hệ admin nếu cần khôi phục.",
      archiveCta: "Lưu trữ CLB",
      archiveModalTitle: "Xác nhận lưu trữ",
      archiveModalBody:
        "Bạn sắp lưu trữ CLB \"{name}\". Hành động này sẽ ẩn CLB khỏi /clubs và dropdown của bạn.",
      archiveModalInputLabel: "Gõ \"{name}\" để xác nhận",
      archiveConfirmCta: "Lưu trữ CLB",
      archiving: "Đang lưu trữ…",
      archiveSuccessTitle: "Đã lưu trữ CLB",
      archiveSuccessBody: "CLB đã được ẩn khỏi danh sách công khai.",
    },
    managers: {
      heading: "Người quản lý CLB",
      subheading:
        "Người tạo CLB có thể thêm tối đa nhiều người quản lý. Người quản lý có toàn quyền tạo / sửa / huỷ sự kiện, sửa thông tin CLB, nhưng KHÔNG thể xoá hay archive CLB.",
      creatorBadge: "Người tạo",
      managerBadge: "Quản lý",
      addCta: "Thêm người quản lý",
      searchLabel: "Tìm theo email hoặc số điện thoại",
      searchPlaceholder: "vd: ten@email.com hoặc +84901234567",
      searchButton: "Tìm",
      searching: "Đang tìm…",
      searchEmpty: "Không tìm thấy người dùng có email/SĐT này. Họ cần đăng ký tài khoản ThePickleHub trước.",
      searchInvalid: "Vui lòng nhập email hoặc số điện thoại (≥4 ký tự).",
      addConfirm: "Thêm {name} làm người quản lý?",
      addSuccess: "Đã thêm {name} làm người quản lý.",
      addError: "Không thể thêm người quản lý — vui lòng thử lại.",
      removeAria: "Xoá người quản lý",
      removeConfirm: "Xoá quyền quản lý của {name}?",
      removeSuccess: "Đã xoá {name} khỏi danh sách quản lý.",
      removeError: "Không thể xoá — vui lòng thử lại.",
      addedBy: "Thêm vào {date}",
      empty: "Chưa có người quản lý nào.",
      ownerOnly: "Chỉ người tạo CLB có thể thêm/xoá quản lý.",
      errAlreadyManager: "Người này đã là quản lý CLB.",
      errAlreadyCreator: "Người này là người tạo CLB rồi — không cần thêm.",
      errProfileNotFound: "Không tìm thấy hồ sơ này.",
      errNotAuthorized: "Bạn không có quyền thực hiện hành động này.",
    },
    roster: {
      pageTitle: "Danh sách đăng ký",
      registeredCount: "Đã đăng ký",
      paidCount: "Đã thanh toán",
      claimedCount: "Player đã claim",
      noRegistrations: "Chưa có ai đăng ký.",
      addManual: "Thêm thủ công",
      addManualTitle: "Thêm người tham gia",
      addManualSubmit: "Thêm vào danh sách",
      export: "Tải CSV",
      colName: "Tên",
      colPhone: "Số ĐT",
      colLevel: "Trình độ",
      colStatus: "Trạng thái",
      colPayment: "Thanh toán",
      colReferenceCode: "Mã thanh toán",
      colTransferStatus: "Trạng thái CK",
      colRegistered: "Đăng ký lúc",
      colActions: "Thao tác",
      actionCheckIn: "Check-in",
      actionUndoCheckIn: "Bỏ check-in",
      actionMarkPaid: "Đánh dấu đã thanh toán",
      actionMarkUnpaid: "Đánh dấu chưa thanh toán",
      actionMarkNoShow: "Vắng mặt",
      actionCancel: "Huỷ đăng ký",
      actionEditNotes: "Ghi chú",
      confirmCancelTitle: "Huỷ đăng ký của người này?",
      confirmCancelBody:
        "Số điện thoại sẽ được giải phóng và có thể đăng ký lại.",
      confirmNoShowTitle: "Đánh dấu vắng mặt?",
      confirmNoShowBody: "Người này vẫn nằm trong danh sách nhưng không tính sĩ số sân.",
      notesPlaceholder: "Ghi chú nội bộ (không hiển thị công khai)",
      saveNotes: "Lưu",
      updatedToast: "Đã cập nhật",
      deletedToast: "Đã huỷ đăng ký",
      transferClaimed: "Player đã chuyển",
      transferNotClaimed: "Chưa chuyển",
      reconcileBanner: "Player tự đánh dấu đã chuyển. Hãy đối chiếu với app ngân hàng (tìm theo mã PHUB-XXXXXX) trước khi cho phép chơi.",
      viewProfileHint: "Xem profile",
    },
    matchmaking: {
      pageTitle: "Xếp cặp — Matchmaking",
      tabMexicano: "Mexicano",
      tabRoundRobin: "Round Robin",
      selectPlayersTitle: "Chọn người tham gia",
      selectAll: "Chọn tất cả",
      selectNone: "Bỏ chọn",
      selectedCount: "Đã chọn {n} người",
      roundsLabel: "Số vòng",
      courtsLabel: "Số sân",
      generate: "Tạo lịch trận",
      regenerate: "Tạo lại",
      oddPlayersWarning: "Số người không chia hết cho 4 — sẽ có người ngồi ngoài mỗi vòng.",
      schedule: "Lịch trận",
      round: "Vòng",
      court: "Sân",
      teamA: "Cặp A",
      teamB: "Cặp B",
      sittingOut: "Ngồi ngoài",
      print: "In",
      copy: "Sao chép",
      copied: "Đã sao chép",
      empty: "Chưa có lịch — chọn người chơi rồi nhấn \"Tạo lịch trận\".",
      notEnoughPlayers: "Cần ít nhất 4 người để xếp cặp.",
      saveToEvent: "Lưu vào sự kiện",
      savingToEvent: "Đang lưu…",
      savedToEventToast: "Đã lưu lịch trận. Người chơi có thể vào trang Live để xem.",
      saveOverwriteConfirmTitle: "Ghi đè lịch hiện có?",
      saveOverwriteConfirmBody: "Sự kiện đã có lịch trận trước đó. Lưu mới sẽ xóa toàn bộ trận cũ và thay bằng lịch này.",
      openLivePage: "Mở trang Live",
      savedScheduleBanner: "Đây là lịch đã lưu trong sự kiện.",
      regenerateHint: "Chọn lại người chơi và nhấn \"Tạo lịch trận\" để xếp lại — lịch mới sẽ thay thế lịch hiện tại sau khi bạn lưu.",
    },
    live: {
      pageTitle: "Live — đang diễn ra",
      pageTitleSpectator: "Live — theo dõi",
      noScheduleTitle: "Chưa có lịch trận",
      noScheduleBody: "BTC chưa lưu lịch xếp cặp cho sự kiện này. Vui lòng quay lại sau.",
      notRegisteredTitle: "Bạn chưa đăng ký",
      notRegisteredBody: "Đang ở chế độ khán giả. Đăng ký để hiển thị trận của riêng bạn.",
      zoneNow: "Trận hiện tại",
      zoneNoNow: "Bạn chưa có trận đang diễn ra.",
      zoneNowOrganizerSubtitle: "Các trận đang diễn ra ({n})",
      zoneNowOrganizerEmpty: "Chưa có trận nào đang diễn ra. Nhấn \"Bắt đầu chơi\" ở trận kế tiếp để chấm điểm.",
      zoneRestingTitle: "Đang nghỉ",
      zoneRestingBody: "Trận kế tiếp của bạn — vòng {round}, sân {court}.",
      zoneRestingNoNext: "Bạn đã chơi xong tất cả trận.",
      zoneNext: "Trận kế tiếp",
      zoneNoNext: "Không còn trận nào trong lịch.",
      zoneNextHint: "Trận sớm nhất chưa bắt đầu trong sự kiện.",
      zoneStandings: "Bảng xếp hạng",
      zoneStandingsEmpty: "Chưa có người chơi nào đăng ký.",
      zoneScoreInput: "Nhập tỉ số",
      zoneZalo: "Nhóm Zalo sự kiện",
      openZalo: "Mở nhóm Zalo",
      startMatch: "Bắt đầu chơi",
      startMatchHint: "Đánh dấu trận đang diễn ra để bắt đầu nhập tỉ số.",
      starting: "Đang bắt đầu…",
      court: "Sân",
      round: "Vòng",
      teamA: "Cặp A",
      teamB: "Cặp B",
      versus: "vs",
      submitScore: "Xác nhận tỉ số",
      submitting: "Đang gửi…",
      awaitingOpponent: "Chờ đối thủ xác nhận",
      bothConfirmed: "Đã xác nhận xong",
      statusScheduled: "Chưa bắt đầu",
      statusInProgress: "Đang chơi",
      statusCompleted: "Đã xong",
      organizerOverride: "Ghi nhận tỉ số (BTC)",
      organizerOverrideHint: "Bạn là BTC — thao tác này sẽ chốt tỉ số ngay không cần đối thủ xác nhận.",
      colRank: "#",
      colPlayer: "Người chơi",
      colWins: "T",
      colLosses: "B",
      colDiff: "+/-",
      youLabel: "Bạn",
      scoreToast: "Đã gửi tỉ số, chờ đối thủ xác nhận.",
      scoreCompletedToast: "Trận đã chốt!",
      scoreErrorToast: "Không gửi được tỉ số. Thử lại.",
      notInMatchToast: "Bạn không nằm trong trận này.",
      organizerCta: "Quản lý sự kiện",
      backToEvent: "Về trang sự kiện",
    },
    payment: {
      amountLabel: "Số tiền cần chuyển",
      qrAlt: "Mã VietQR thanh toán",
      bankLabel: "Ngân hàng",
      accountNumberLabel: "Số tài khoản",
      accountNameLabel: "Chủ tài khoản",
      memoLabel: "Nội dung CK",
      referenceCodeLabel: "Mã thanh toán của bạn",
      warning: "Ghi đúng nội dung CK để BTC đối chiếu. Mang theo bằng chứng chuyển khoản (screenshot) khi tới sân.",
      claimButton: "Tôi đã chuyển tiền",
      skipButton: "Sẽ thanh toán tại sân",
      submitting: "Đang gửi…",
      claimedTitle: "Đã ghi nhận",
      claimedBody: "Cảm ơn bạn. BTC sẽ đối chiếu giao dịch trước khi bạn vào sân.",
      claimedHint: "Lưu mã này hoặc screenshot màn hình để BTC tra cứu nếu cần.",
      claimedToast: "Đã đánh dấu đã chuyển tiền.",
      claimError: "Không gửi được yêu cầu. Thử lại.",
      copiedToast: "Đã sao chép!",
      prepaymentWarningTitle: "Event này yêu cầu chuyển khoản trước",
      prepaymentWarningDescription:
        "Nếu không hoàn tất thanh toán trong {hours} giờ ({deadline}), đăng ký của bạn sẽ tự động bị huỷ.",
      payLater: "Tôi sẽ thanh toán sau",
      unpaidStatusBadge: "Chưa thanh toán",
    },
    profile: {
      notFoundTitle: "Không tìm thấy profile",
      notFoundBody: "Profile này không tồn tại hoặc đã bị xoá.",
      levelLabel: "Level",
      eventsPlayedShort: "Đã chơi {n} event",
      matchesPlayedShort: "{n} trận",
      ghostHint: "Player này đăng ký qua OTP, chưa tạo tài khoản đầy đủ.",
      stats: {
        eventsLabel: "Event",
        matchesLabel: "Trận",
        winsLabel: "Thắng",
        streakLabel: "Streak hiện tại",
      },
      badgesHeading: "Badges",
      historyHeading: "Lịch sử trận đấu",
      lockedHint: "Còn {remaining} để mở khoá",
      earnedOn: "Đạt được vào {date}",
      history: {
        empty: "Chưa có trận nào hoàn thành.",
        partner: "Cặp",
        vs: "vs",
        loadMore: "Xem thêm",
        loading: "Đang tải…",
      },
      badges: {
        first_event:   { title: "Lần đầu góp mặt",   description: "Đăng ký event đầu tiên trên ThePickleHub." },
        first_match:   { title: "Trận đầu",          description: "Chơi xong trận đấu đầu tiên." },
        first_win:     { title: "Chiến thắng đầu",   description: "Thắng trận đấu đầu tiên." },
        event_5:       { title: "5 events",          description: "Đã chơi 5 events." },
        event_10:      { title: "10 events",         description: "Đã chơi 10 events." },
        event_25:      { title: "25 events",         description: "Đã chơi 25 events." },
        event_50:      { title: "50 events",         description: "Đã chơi 50 events." },
        match_10:      { title: "10 trận",           description: "Đã hoàn thành 10 trận đấu." },
        match_50:      { title: "50 trận",           description: "Đã hoàn thành 50 trận đấu." },
        match_100:     { title: "100 trận",          description: "Đã hoàn thành 100 trận đấu." },
        win_streak_3:  { title: "Streak 3",          description: "Thắng 3 trận liên tiếp." },
        win_streak_5:  { title: "Streak 5",          description: "Thắng 5 trận liên tiếp." },
        night_owl:     { title: "Cú đêm",            description: "Đăng ký event diễn ra sau 21:00." },
      },
    },
  },
  toast: {
    common: {
      authRequired: "Vui lòng đăng nhập",
      unknownError: "Có lỗi xảy ra",
    },
    registration: {
      submit: {
        authRequired: "Vui lòng đăng nhập để đăng ký",
        displayNameRequired: "Tên hiển thị không được để trống",
        duplicate: "Bạn đã đăng ký tham gia giải này rồi",
        success: "Đăng ký thành công! Vui lòng chờ BTC duyệt.",
        error: "Không thể đăng ký, vui lòng thử lại",
      },
      update: {
        success: "Đã cập nhật đăng ký",
        error: "Không thể cập nhật, vui lòng thử lại",
      },
      cancel: {
        success: "Đã hủy đăng ký",
        error: "Không thể hủy đăng ký",
      },
      approve: {
        success: "Đã duyệt đăng ký",
        error: "Không thể duyệt đăng ký",
      },
      reject: {
        success: "Đã từ chối đăng ký",
        error: "Không thể từ chối đăng ký",
      },
      bulkApprove: {
        success: "Đã duyệt {count} đăng ký",
        error: "Không thể duyệt hàng loạt",
      },
      btcOverride: {
        success: "Đã cập nhật thông tin",
        error: "Không thể cập nhật",
      },
    },
    teamRegistration: {
      createTeam: {
        authRequired: "Vui lòng đăng nhập để đăng ký",
        duplicate: "Bạn đã đăng ký tham gia giải này rồi",
        displayNameRequired: "Tên hiển thị không được để trống",
        success: "Đăng ký thành công! Bạn có thể mời partner ngay bây giờ.",
        error: "Không thể đăng ký, vui lòng thử lại",
      },
      createInvitation: {
        maxReached: "Bạn đã gửi tối đa 3 lời mời. Vui lòng hủy bớt để tạo mới.",
        success: "Đã tạo link mời partner",
        error: "Không thể tạo lời mời",
      },
      cancelInvitation: {
        success: "Đã hủy lời mời",
        error: "Không thể hủy lời mời",
      },
      acceptInvitation: {
        success: "Đã tham gia đội thành công!",
        error: "Không thể tham gia đội",
        codes: {
          INVITATION_NOT_FOUND: "Link mời không tồn tại",
          INVITATION_ALREADY_USED: "Link mời đã được sử dụng",
          INVITATION_EXPIRED: "Link mời đã hết hạn",
          TEAM_NOT_FOUND: "Đội không tồn tại",
          TEAM_ALREADY_COMPLETE: "Đội đã đủ 2 người",
          TABLE_LOCKED: "Giải đấu đã diễn ra",
          CANNOT_JOIN_OWN_TEAM: "Bạn không thể tham gia đội của chính mình",
        },
      },
      removePartner: {
        success: "Đã xóa partner khỏi đội",
        error: "Không thể xóa partner",
        codes: {
          TEAM_NOT_FOUND: "Đội không tồn tại",
          PERMISSION_DENIED: "Bạn không có quyền thực hiện thao tác này",
          TABLE_LOCKED: "Giải đấu đã diễn ra",
        },
      },
      btcManage: {
        approved: "Đã duyệt đội",
        rejected: "Đã từ chối đội",
        removed: "Đã loại đội khỏi giải",
        error: "Không thể thực hiện thao tác",
        codes: {
          TEAM_NOT_FOUND: "Đội không tồn tại",
          PERMISSION_DENIED: "Bạn không có quyền thực hiện thao tác này",
          INVALID_ACTION: "Thao tác không hợp lệ",
        },
      },
    },
    pairRequest: {
      create: {
        success: "Đã gửi yêu cầu ghép đôi. Đang chờ xác nhận.",
        error: "Không thể gửi yêu cầu ghép đôi",
        codes: {
          AUTH_REQUIRED: "Vui lòng đăng nhập",
          TABLE_NOT_FOUND: "Giải không tồn tại",
          TABLE_LOCKED: "Giải đấu đã diễn ra",
          NO_TEAM: "Bạn chưa đăng ký tham gia giải",
          TEAM_REJECTED: "Bạn đã bị từ chối tham gia giải",
          ALREADY_HAS_PARTNER: "Bạn đã có partner",
          TARGET_TEAM_NOT_FOUND: "Người chơi không tồn tại",
          TARGET_TEAM_REJECTED: "Người chơi đã bị từ chối",
          TARGET_HAS_PARTNER: "Người chơi đã có partner",
          SAME_TEAM: "Không thể ghép đôi với chính mình",
          REQUEST_ALREADY_SENT: "Bạn đã gửi yêu cầu ghép đôi này rồi",
          REQUEST_PENDING_FROM_TARGET: "Người này đang chờ bạn xác nhận ghép đôi",
        },
      },
      respond: {
        acceptSuccess: "Đã ghép đôi thành công!",
        rejectSuccess: "Đã từ chối yêu cầu ghép đôi",
        error: "Không thể xử lý yêu cầu",
        codes: {
          AUTH_REQUIRED: "Vui lòng đăng nhập",
          REQUEST_NOT_FOUND: "Yêu cầu không tồn tại",
          NOT_TARGET_USER: "Bạn không có quyền xử lý yêu cầu này",
          REQUEST_NOT_PENDING: "Yêu cầu đã được xử lý",
          TABLE_LOCKED: "Giải đấu đã diễn ra",
          FROM_TEAM_ALREADY_PAIRED: "Người gửi yêu cầu đã có partner",
          TO_TEAM_ALREADY_PAIRED: "Bạn đã có partner",
        },
      },
      cancel: {
        success: "Đã hủy yêu cầu ghép đôi",
        error: "Không thể hủy yêu cầu",
      },
    },
    parentTournament: {
      create: {
        nameRequired: "Tên giải không được để trống",
        error: "Không thể tạo giải tổng",
        permissionDenied: "Bạn không có quyền tạo giải tổng",
      },
      delete: {
        hasChildren: "Bạn phải xoá tất cả nội dung con trước khi xoá giải tổng",
        success: "Đã xoá giải tổng",
        error: "Không thể xoá giải tổng",
        permissionDenied: "Bạn không có quyền xoá giải tổng này",
      },
    },
    table: {
      createTable: {
        authRequired: "Vui lòng đăng nhập để tạo bảng đấu",
        nameRequired: "Tên giải không được để trống",
        limitReached: "Đã đạt giới hạn soft launch: mỗi tài khoản chỉ được tạo tối đa 3 giải.",
        error: "Không thể tạo bảng đấu",
      },
      addPlayers: {
        permissionDenied: "Bạn không có quyền thêm VĐV cho giải này",
        error: "Không thể thêm người chơi",
      },
      createGroups: {
        permissionDenied: "Bạn không có quyền tạo bảng cho giải này",
        error: "Không thể tạo bảng",
      },
      createGroupMatches: {
        permissionDenied: "Bạn không có quyền tạo trận đấu",
        error: "Không thể tạo trận đấu",
      },
      updateMatchScore: {
        permissionDenied: "Bạn không có quyền chấm điểm trận này",
      },
      updateTableStatus: {
        permissionDenied: "Bạn không có quyền cập nhật trạng thái giải",
      },
      movePlayer: {
        permissionDenied: "Bạn không có quyền di chuyển VĐV",
        error: "Không thể di chuyển VĐV",
      },
      addPlayerToGroup: {
        permissionDenied: "Bạn không có quyền thêm VĐV vào bảng",
        error: "Không thể thêm VĐV",
      },
      removePlayer: {
        permissionDenied: "Bạn không có quyền xoá VĐV",
        error: "Không thể xoá VĐV",
      },
      regenerateGroupMatches: {
        permissionDenied: "Bạn không có quyền tạo lại trận",
      },
      updateCourtSettings: {
        permissionDenied: "Bạn không có quyền cập nhật sân/giờ",
      },
      reassignCourtsAndTimes: {
        permissionDenied: "Bạn không có quyền cập nhật lịch",
      },
      deleteTable: {
        success: "Đã xoá giải đấu",
        permissionDenied: "Bạn không có quyền xoá giải đấu này",
        error: "Không thể xoá giải đấu",
      },
      updateCourtName: {
        permissionDenied: "Bạn không có quyền đổi tên sân",
      },
    },
    referee: {
      add: {
        success: "Đã thêm trọng tài: {name}",
        notFound: "Không tìm thấy người dùng với email này",
        duplicate: "Người này đã là trọng tài",
        error: "Không thể thêm trọng tài",
      },
      remove: {
        success: "Đã gỡ trọng tài",
        error: "Không thể gỡ trọng tài",
      },
    },
  },
};
