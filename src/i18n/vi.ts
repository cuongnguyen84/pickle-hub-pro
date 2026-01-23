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
  account: {
    deleteAccount: string;
    deleteAccountDescription: string;
    deleteAccountConfirm: string;
    deleteAccountWarning: string;
    deleteAccountSuccess: string;
    deleteAccountError: string;
    typeToConfirm: string;
    confirmText: string;
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
      duplicateInMatch: string;
      includeDoublesInSingles: string;
      noDoublesStats: string;
      countsForStandings: string;
      noGroupHint: string;
      playerPanel: string;
      openPlayerPanel: string;
      teams: string;
    };
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
      badge: string;
      mainTitle: string;
      mainDescription: string;
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
    };
    groups: {
      groups: string;
      playersPerGroup: string;
      advanceToPlayoff: string;
      noConfig: string;
      tryOther: string;
      quotaUsed: string;
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
  };
  news: {
    title: string;
    subtitle: string;
    noNews: string;
    readMore: string;
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
  account: {
    deleteAccount: "Xóa tài khoản",
    deleteAccountDescription: "Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu của bạn. Hành động này không thể hoàn tác.",
    deleteAccountConfirm: "Xác nhận xóa tài khoản",
    deleteAccountWarning: "Cảnh báo: Tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn bao gồm hồ sơ, giải đấu, bình luận và các hoạt động khác.",
    deleteAccountSuccess: "Tài khoản đã được xóa thành công",
    deleteAccountError: "Không thể xóa tài khoản. Vui lòng thử lại.",
    typeToConfirm: "Nhập \"{text}\" để xác nhận",
    confirmText: "XOA TAI KHOAN",
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
    openMenu: "Mở menu",
    closeMenu: "Đóng menu",
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
      dropPlayerHere: "Kéo VĐV vào đây",
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
      duplicateInMatch: "VĐV này đã có trong trận này",
      includeDoublesInSingles: "Tính cả các trận đôi",
      noDoublesStats: "Chưa có thống kê đôi",
      countsForStandings: "Tính vào bảng xếp hạng",
      noGroupHint: "Tạo bảng đấu để xem thống kê",
      playerPanel: "Danh sách VĐV",
      openPlayerPanel: "Mở danh sách VĐV",
      teams: "Đội",
    },
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
      badge: "Livestream & Video",
      mainTitle: "ThePickleHub – Nền tảng Pickleball Toàn Cầu",
      mainDescription: "Xem livestream trực tiếp các giải đấu pickleball, theo dõi bracket, và kết nối với cộng đồng pickleball khắp nơi trên thế giới.",
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
    },
    groups: {
      groups: "bảng",
      playersPerGroup: "người/bảng",
      advanceToPlayoff: "người vào Playoff",
      noConfig: "Không có cấu hình phù hợp với {count} người.",
      tryOther: "Thử số người chơi khác.",
      quotaUsed: "{count}/{total} giải đã tạo",
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
  },
  news: {
    title: "Tin tức Pickleball",
    subtitle: "Tổng hợp nhanh các cập nhật pickleball từ nguồn uy tín.",
    noNews: "Chưa có cập nhật. Tin tức sẽ hiển thị tại đây khi có nội dung mới.",
    readMore: "Đọc thêm",
  },
};
