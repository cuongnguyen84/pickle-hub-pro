import { Link } from "react-router-dom";

/**
 * SEO landing page content for /tools hub
 * ~800 words of keyword-rich, educational content
 */
export const ToolsHubSeoContent = () => (
  <section className="mt-16 border-t border-border pt-12 space-y-8 max-w-3xl">
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
        What Are Pickleball Tournament Tools?
      </h2>
      <p className="text-muted-foreground mb-4">
        Pickleball tournament tools are specialized software designed to help organizers create brackets, manage players, schedule matches, and track scores for pickleball competitions. Unlike generic tournament platforms, pickleball-specific tools account for the sport's unique requirements: court rotation, rest time between games, doubles pairing logic, and the various formats used across recreational, club, and competitive play.
      </p>
      <p className="text-muted-foreground">
        The Pickle Hub offers a complete suite of free pickleball tournament tools that cover every format — from casual round robin events at your local club to MLP-style team competitions and large-scale double elimination brackets. Each tool is purpose-built for pickleball organizers, referees, and players.
      </p>
    </div>

    <div>
      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
        Why Use Pickleball-Specific Tournament Software?
      </h2>
      <p className="text-muted-foreground mb-4">
        Many organizers still rely on spreadsheets, whiteboards, or generic platforms like Challonge to run pickleball tournaments. While these work in a pinch, they create pain points that pickleball-specific tools solve:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
        <li><strong>Court rotation complexity</strong> — Pickleball venues often have limited courts. Our tools automatically schedule matches to maximize court usage and minimize player wait times.</li>
        <li><strong>Doubles pairing logic</strong> — Round robin doubles tournaments need intelligent pairing to avoid rematches and ensure balanced competition. Generic bracket makers don't handle this.</li>
        <li><strong>Real-time scoring</strong> — Referees and organizers can update scores from their phones, with live standings visible to all participants instantly.</li>
        <li><strong>Format variety</strong> — Pickleball uses round robin, single elimination, double elimination, MLP team format, and hybrid formats. One platform handles them all.</li>
      </ul>
      <p className="text-muted-foreground">
        The result: less time managing logistics, more time playing pickleball. Our tools are free, mobile-friendly, and require no app download — just open your browser and start organizing.
      </p>
    </div>

    <div>
      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
        Choose the Right Pickleball Tournament Format
      </h2>
      <p className="text-muted-foreground mb-4">
        Selecting the right tournament format depends on your player count, available courts, time constraints, and competitive level. Here's how each tool maps to common scenarios:
      </p>
      <div className="space-y-3">
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <Link to="/tools/quick-tables" className="font-semibold text-primary hover:underline">Quick Tables — Pickleball Bracket Generator</Link>
          <p className="text-sm text-muted-foreground mt-1">Best for: Club events with 4–48 players. Supports round robin groups with automatic playoff seeding. The fastest way to get a pickleball tournament running.</p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <Link to="/tools/team-match" className="font-semibold text-primary hover:underline">Team Match — MLP-Style Pickleball Competition</Link>
          <p className="text-sm text-muted-foreground mt-1">Best for: Team-based events with 2–16 teams. Inspired by Major League Pickleball with lineup management, dreambreaker games, and rally scoring.</p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <Link to="/tools/doubles-elimination" className="font-semibold text-primary hover:underline">Doubles Elimination — Double Elimination Bracket</Link>
          <p className="text-sm text-muted-foreground mt-1">Best for: Competitive events with 32+ teams. Gives every team a second chance through the losers bracket before elimination.</p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <Link to="/tools/flex-tournament" className="font-semibold text-primary hover:underline">Flex Tournament — Custom Pickleball Bracket Maker</Link>
          <p className="text-sm text-muted-foreground mt-1">Best for: Non-standard formats, training sessions, or creative tournament structures. Full control over groups, matches, and scoring rules.</p>
        </div>
      </div>
    </div>

    <div>
      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
        Built for Pickleball Organizers, Referees & Players
      </h2>
      <p className="text-muted-foreground">
        Whether you're a club director running weekly round robins, a tournament director managing a 128-team bracket, or a referee scoring matches on the go — The Pickle Hub's tournament tools are designed for you. All tools are free, work on any device, and require no technical expertise. Create your first pickleball tournament bracket in under 60 seconds.
      </p>
    </div>

    <div>
      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">
        Learn More About Pickleball Tournament Organization
      </h2>
      <p className="text-muted-foreground mb-3">
        Read our in-depth guides to get the most out of your pickleball events:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
        <li><Link to="/blog/best-pickleball-tournament-software-2026" className="text-primary hover:underline">Best Pickleball Tournament Software 2026</Link> — Compare free tools for organizing pickleball competitions.</li>
        <li><Link to="/blog/how-to-create-pickleball-bracket" className="text-primary hover:underline">How to Create a Pickleball Bracket</Link> — Step-by-step guide for round robin and elimination brackets.</li>
        <li><Link to="/blog/pickleball-round-robin-generator-guide" className="text-primary hover:underline">Pickleball Round Robin Generator Guide</Link> — Everything you need to run the perfect round robin tournament.</li>
      </ul>
    </div>
  </section>
);

/**
 * SEO content for /tools/quick-tables
 */
export const QuickTablesSeoContent = () => (
  <section className="mt-12 border-t border-border pt-10 space-y-8 max-w-3xl text-left">
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        What Is a Pickleball Bracket Generator?
      </h2>
      <p className="text-muted-foreground mb-3">
        A pickleball bracket generator is a tool that automatically creates tournament brackets based on your player count and chosen format. Instead of manually drawing brackets on a whiteboard or wrestling with spreadsheets, you enter your players, select round robin or playoff format, and the system generates a complete schedule with balanced groups, match ordering, and court assignments.
      </p>
      <p className="text-muted-foreground">
        Quick Tables is The Pickle Hub's bracket generator, designed specifically for pickleball tournaments. It handles the nuances that generic tools miss: automatic group balancing by skill level, team-aware seeding to prevent teammates from being in the same group, and scheduling that minimizes court wait times — a critical factor when venues have limited courts.
      </p>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Why Use a Pickleball-Specific Bracket Generator?
      </h2>
      <p className="text-muted-foreground mb-3">
        Generic bracket tools like Challonge or Excel work for simple single-elimination events, but pickleball tournaments have unique needs:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Court rotation</strong> — With 4–8 courts, scheduling must ensure no player waits too long between matches. Our tool optimizes match order for maximum court utilization.</li>
        <li><strong>Round robin fairness</strong> — In group stages, every player needs to face every other player. Our algorithm creates balanced schedules regardless of odd or even player counts.</li>
        <li><strong>Skill-based seeding</strong> — Enter player skill levels and the system distributes top players evenly across groups, preventing lopsided competition.</li>
        <li><strong>Instant playoff brackets</strong> — After round robin, the system automatically seeds players into playoff brackets based on group standings and point differentials.</li>
      </ul>
      <p className="text-muted-foreground">
        Organizers save hours of manual work. Players get a professional tournament experience. Referees can score matches from their phone with live updates for everyone.
      </p>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        How Quick Tables Works for Real Pickleball Events
      </h2>
      <ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Enter player count</strong> — Tell us how many players or teams are competing (2–200 supported).</li>
        <li><strong>Choose your format</strong> — Select round robin for group play, or large playoff for elimination-style tournaments with 48+ players.</li>
        <li><strong>Configure groups</strong> — The system suggests optimal group sizes. You can adjust or manually assign players to specific groups.</li>
        <li><strong>Add player names & seeds</strong> — Enter names, optional team affiliations, and skill ratings for intelligent distribution.</li>
        <li><strong>Generate bracket</strong> — One click creates your complete tournament bracket with match schedule and court assignments.</li>
        <li><strong>Score & track live</strong> — Referees update scores in real-time. Standings, point differentials, and playoff qualification update automatically.</li>
      </ol>
      <p className="text-muted-foreground">
        The entire setup takes under 2 minutes for a typical 16-player club tournament.
      </p>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        When to Use Round Robin vs Other Pickleball Formats
      </h2>
      <p className="text-muted-foreground mb-3">
        Round robin is the most popular format for recreational and club pickleball because every player gets to play multiple matches. But it's not always the best choice:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Round Robin (Quick Tables)</strong> — Best for 4–32 players. Everyone plays everyone in their group. Maximum court time for all players. Ideal for social/club events.</li>
        <li><strong><Link to="/tools/doubles-elimination" className="text-primary hover:underline">Double Elimination</Link></strong> — Best for 32+ teams in competitive settings. Players get a second chance through the losers bracket.</li>
        <li><strong><Link to="/tools/team-match" className="text-primary hover:underline">Team Match (MLP)</Link></strong> — Best for team-based events. Teams compete across multiple game types with lineup strategy.</li>
        <li><strong><Link to="/tools/flex-tournament" className="text-primary hover:underline">Flex Tournament</Link></strong> — Best for custom formats, training, or experimental tournament structures with no rules restrictions.</li>
      </ul>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Related Pickleball Tournament Tools on The Pickle Hub
      </h2>
      <p className="text-muted-foreground mb-3">
        Quick Tables is part of The Pickle Hub's complete tournament toolkit. Explore our other tools for different tournament formats and needs:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
        <li><Link to="/tools/team-match" className="text-primary hover:underline">Pickleball Team Match format</Link> — Run MLP-style team competitions with dreambreaker games and rally scoring.</li>
        <li><Link to="/tools/doubles-elimination" className="text-primary hover:underline">Double elimination pickleball tournaments</Link> — Fair bracket system for competitive 32+ team events.</li>
        <li><Link to="/tools/flex-tournament" className="text-primary hover:underline">Flexible pickleball tournament formats</Link> — Create custom tournament structures with no format restrictions.</li>
        <li><Link to="/tools" className="text-primary hover:underline">All pickleball tournament tools</Link> — Browse the complete suite of free tournament management tools.</li>
      </ul>
    </div>
  </section>
);

/**
 * SEO content for /tools/team-match
 */
export const TeamMatchSeoContent = () => (
  <section className="mt-12 border-t border-border pt-10 space-y-8 max-w-3xl text-left">
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        What Is a Pickleball Team Match (MLP Format)?
      </h2>
      <p className="text-muted-foreground mb-3">
        A pickleball team match is a competition format where teams of players compete against each other across multiple game types — typically men's doubles, women's doubles, mixed doubles, and a dreambreaker tiebreaker. This format is inspired by Major League Pickleball (MLP), the professional team league that has popularized team-based pickleball competition worldwide.
      </p>
      <p className="text-muted-foreground">
        The Pickle Hub's Team Match tool lets you organize MLP-style competitions at any level — from casual inter-club matches to structured league seasons. Captains manage lineups, the system tracks team standings, and dreambreaker games add exciting tiebreak drama to close matches.
      </p>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Why Use a Pickleball-Specific Team Match Tool?
      </h2>
      <p className="text-muted-foreground mb-3">
        Running team-based pickleball competitions manually is complex. You need to track rosters, manage lineups for each match, calculate team scores across multiple game types, and handle tiebreakers. Spreadsheets quickly become unmanageable. Here's why our dedicated tool is better:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Lineup management</strong> — Captains assign players to each game type strategically. The system validates lineup rules and prevents conflicts.</li>
        <li><strong>Dreambreaker support</strong> — When team matches are tied, the dreambreaker format creates sudden-death excitement. Our tool handles the unique scoring rules automatically.</li>
        <li><strong>Rally scoring tracking</strong> — MLP uses rally scoring (every rally scores a point). Our system tracks this format natively, unlike generic scorekeepers.</li>
        <li><strong>Team standings</strong> — Automatic calculation of wins, losses, game differentials, and tiebreakers across round robin or playoff stages.</li>
      </ul>
      <p className="text-muted-foreground">
        For pickleball clubs and leagues looking to add team competition, this tool handles all the complexity so organizers can focus on the competition itself.
      </p>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        How Team Match Works in Real Pickleball Events
      </h2>
      <ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Create tournament</strong> — Set the number of teams, players per team, and choose round robin, single elimination, or round robin + playoff format.</li>
        <li><strong>Configure game templates</strong> — Define which game types each match includes (men's doubles, women's doubles, mixed doubles, singles, dreambreaker).</li>
        <li><strong>Register teams</strong> — Teams register with full rosters. Captains can be assigned for lineup decisions.</li>
        <li><strong>Set lineups</strong> — Before each team match, captains select which players play in each game type.</li>
        <li><strong>Score matches</strong> — Referees score individual games. Team match winners are determined by total games won.</li>
        <li><strong>Track standings</strong> — The system automatically updates team standings, qualifications, and playoff seedings.</li>
      </ol>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        When to Use Team Match vs Other Pickleball Formats
      </h2>
      <p className="text-muted-foreground mb-3">
        Team match format shines when you want team identity and strategic depth. Here's how it compares to other formats available on The Pickle Hub:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Team Match (this tool)</strong> — Best for 2–16 teams. Creates team rivalry, strategic lineup decisions, and multiple game types per match. Ideal for leagues and inter-club competition.</li>
        <li><strong><Link to="/tools/quick-tables" className="text-primary hover:underline">Quick Tables (Round Robin)</Link></strong> — Best for individual player tournaments with 4–48 players. Everyone plays everyone, no team structure needed.</li>
        <li><strong><Link to="/tools/doubles-elimination" className="text-primary hover:underline">Double Elimination</Link></strong> — Best for large competitive brackets with 32+ teams. Pure elimination format with a losers bracket for fairness.</li>
        <li><strong><Link to="/tools/flex-tournament" className="text-primary hover:underline">Flex Tournament</Link></strong> — Best for custom or experimental formats. Full flexibility when standard formats don't fit your event.</li>
      </ul>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Related Pickleball Tournament Tools on The Pickle Hub
      </h2>
      <p className="text-muted-foreground mb-3">
        Team Match is one of several tournament tools available on The Pickle Hub. Use them together for complete event management:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
        <li><Link to="/tools/quick-tables" className="text-primary hover:underline">Pickleball bracket generator</Link> — Create round robin brackets for individual player tournaments.</li>
        <li><Link to="/tools/doubles-elimination" className="text-primary hover:underline">Double elimination pickleball tournaments</Link> — Fair bracket system for large competitive events.</li>
        <li><Link to="/tools/flex-tournament" className="text-primary hover:underline">Flexible pickleball tournament formats</Link> — Build custom tournament structures for any scenario.</li>
        <li><Link to="/tools" className="text-primary hover:underline">All pickleball tournament tools</Link> — Explore the complete toolkit for pickleball event organizers.</li>
      </ul>
    </div>
  </section>
);

/**
 * SEO content for /tools/doubles-elimination
 */
export const DoublesEliminationSeoContent = () => (
  <section className="mt-12 border-t border-border pt-10 space-y-8 max-w-3xl text-left">
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        What Is Double Elimination in Pickleball Tournaments?
      </h2>
      <p className="text-muted-foreground mb-3">
        Double elimination is a tournament format where a team must lose twice before being eliminated. After the first loss, a team drops to the losers bracket and continues competing. Only a second loss ends their tournament run. The winners bracket and losers bracket eventually converge, ensuring the final champion has proven themselves against the strongest competition.
      </p>
      <p className="text-muted-foreground">
        This format is widely used in competitive pickleball events because it rewards consistency and gives teams a second chance — particularly valuable when travel and entry fees are involved. The Pickle Hub's double elimination tool generates complete brackets for 32 to 128+ teams with automatic court scheduling and best-of-1, best-of-3, or best-of-5 match options.
      </p>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Why Use a Pickleball-Specific Double Elimination Tool?
      </h2>
      <p className="text-muted-foreground mb-3">
        Double elimination brackets are significantly more complex than single elimination. Managing the winners bracket, losers bracket, bye rounds, and convergence rounds manually is error-prone and time-consuming. Here's why our dedicated tool matters:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Automatic bracket generation</strong> — Enter your team count and the system creates perfectly balanced winners and losers brackets with correct bye assignments.</li>
        <li><strong>Dynamic court scheduling</strong> — Advanced rounds automatically reassign courts and calculate start times based on when previous rounds finish.</li>
        <li><strong>Variable match formats</strong> — Use best-of-1 for early rounds to save time, then switch to best-of-3 or best-of-5 for semifinals and finals for competitive depth.</li>
        <li><strong>Third-place match option</strong> — Optionally add a consolation final for teams that lose in the semifinals.</li>
        <li><strong>Referee assignment</strong> — Assign referees to specific matches. Officials can score directly from their phones.</li>
      </ul>
      <p className="text-muted-foreground">
        Compare this to Challonge or other generic platforms: our tool understands pickleball's court rotation needs, supports multi-game match formats, and provides a mobile-first experience designed for on-court use.
      </p>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        How Double Elimination Works in Real Pickleball Events
      </h2>
      <ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Create tournament</strong> — Name your event, set team count (32–128+), number of courts, and start time.</li>
        <li><strong>Choose match formats</strong> — Select best-of-1, best-of-3, or best-of-5 for early rounds, semifinals, and finals independently.</li>
        <li><strong>Add teams</strong> — Enter team names with player rosters. Optionally shuffle seeding for random draws.</li>
        <li><strong>Generate bracket</strong> — The system creates winners bracket, losers bracket, bye assignments, and complete match schedule with court and time slots.</li>
        <li><strong>Run the tournament</strong> — As matches complete, losers drop to the losers bracket. Winners advance. The system handles all bracket progression automatically.</li>
        <li><strong>Crown the champion</strong> — Winners and losers brackets converge for the grand final. The undefeated team has bracket advantage.</li>
      </ol>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        When to Use Double Elimination vs Other Pickleball Formats
      </h2>
      <p className="text-muted-foreground mb-3">
        Double elimination excels for competitive events but isn't always the right choice. Here's a comparison with other formats on The Pickle Hub:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Double Elimination (this tool)</strong> — Best for 32+ teams in competitive settings. Gives every team a second chance. Requires more time and courts than single elimination.</li>
        <li><strong><Link to="/tools/quick-tables" className="text-primary hover:underline">Quick Tables (Round Robin)</Link></strong> — Best for smaller events (4–48 players) where everyone wants maximum playing time. More social, less competitive pressure.</li>
        <li><strong><Link to="/tools/team-match" className="text-primary hover:underline">Team Match (MLP)</Link></strong> — Best for team-based competition with strategic lineup management. Different competitive dynamic than bracket play.</li>
        <li><strong><Link to="/tools/flex-tournament" className="text-primary hover:underline">Flex Tournament</Link></strong> — Best for custom formats or when you need to combine elements from multiple format types.</li>
      </ul>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Related Pickleball Tournament Tools on The Pickle Hub
      </h2>
      <p className="text-muted-foreground mb-3">
        Double Elimination is part of The Pickle Hub's tournament platform. Combine it with our other tools for complete event management:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
        <li><Link to="/tools/quick-tables" className="text-primary hover:underline">Pickleball bracket generator</Link> — Round robin brackets with automatic group balancing and playoff seeding.</li>
        <li><Link to="/tools/team-match" className="text-primary hover:underline">Pickleball team match format</Link> — MLP-style team competitions with lineup management and dreambreaker games.</li>
        <li><Link to="/tools/flex-tournament" className="text-primary hover:underline">Flexible pickleball tournament formats</Link> — Build any tournament structure with complete creative freedom.</li>
        <li><Link to="/tools" className="text-primary hover:underline">All pickleball tournament tools</Link> — Browse the complete suite of free tools for pickleball organizers.</li>
      </ul>
    </div>
  </section>
);

/**
 * SEO content for /tools/flex-tournament
 */
export const FlexTournamentSeoContent = () => (
  <section className="mt-12 border-t border-border pt-10 space-y-8 max-w-3xl text-left">
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        What Is a Flex Tournament in Pickleball?
      </h2>
      <p className="text-muted-foreground mb-3">
        A Flex Tournament is a fully customizable competition format where the organizer has complete control over the tournament structure. Unlike standard bracket generators that enforce specific rules (round robin, single elimination, double elimination), Flex Tournament lets you create any combination of groups, matches, and scoring systems that fit your event.
      </p>
      <p className="text-muted-foreground">
        This tool is ideal for pickleball organizers who need to run non-standard formats: training tournaments with rotating partners, skill-level mixing events, multi-format competitions that combine singles and doubles in one event, or any creative tournament structure that doesn't fit traditional bracket categories. You define the rules — the tool handles the logistics.
      </p>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Why Use a Flexible Pickleball Tournament Format?
      </h2>
      <p className="text-muted-foreground mb-3">
        Standard tournament formats work great for most events, but pickleball's diverse community often needs something different. Here's where Flex Tournament excels compared to rigid bracket systems:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>No format restrictions</strong> — Mix singles, doubles, and team matches in the same tournament. Create groups with different numbers of players. Run parallel brackets.</li>
        <li><strong>Training & development events</strong> — Design round robins where players rotate partners each round, perfect for skill development sessions at clubs.</li>
        <li><strong>Custom scoring</strong> — Track any metric you need. The flexible standings system adapts to your rules rather than forcing you into a standard format.</li>
        <li><strong>Hybrid competitions</strong> — Combine group stages with custom knockout rounds, or run separate divisions that merge for a final playoff.</li>
      </ul>
      <p className="text-muted-foreground">
        Generic platforms like Google Sheets give you flexibility but zero automation. Challonge gives you automation but limited flexibility. Flex Tournament gives you both — creative freedom with real-time scoring, automatic standings, and a mobile-friendly interface.
      </p>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        How Flex Tournament Works in Real Pickleball Events
      </h2>
      <ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Create tournament</strong> — Name your event. The system creates a default group and starter matches to get you going quickly.</li>
        <li><strong>Add players & teams</strong> — Add individual players or create teams with multiple members. Drag and drop to organize.</li>
        <li><strong>Create groups</strong> — Define as many groups as you need. Each group can have different players, teams, and match structures.</li>
        <li><strong>Build your matches</strong> — Create singles, doubles, or team matches within each group. Assign players or teams to each side.</li>
        <li><strong>Score live</strong> — Referees and organizers update scores in real-time from any device. Standings recalculate automatically per group.</li>
        <li><strong>Share publicly</strong> — Toggle public visibility so participants and spectators can follow the tournament in real-time.</li>
      </ol>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        When to Use Flex Tournament vs Other Pickleball Formats
      </h2>
      <p className="text-muted-foreground mb-3">
        Flex Tournament is the most versatile option, but specialized tools are faster for standard formats. Here's when to choose what:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-3">
        <li><strong>Flex Tournament (this tool)</strong> — Best for custom formats, training events, mixed-format competitions, or any scenario where standard brackets don't fit. Maximum flexibility, slightly more setup time.</li>
        <li><strong><Link to="/tools/quick-tables" className="text-primary hover:underline">Quick Tables (Round Robin)</Link></strong> — Best for standard round robin with 4–48 players. Faster setup for straightforward group play.</li>
        <li><strong><Link to="/tools/team-match" className="text-primary hover:underline">Team Match (MLP)</Link></strong> — Best for structured team competitions following the MLP format with defined game types and lineup rules.</li>
        <li><strong><Link to="/tools/doubles-elimination" className="text-primary hover:underline">Double Elimination</Link></strong> — Best for large competitive brackets (32+ teams) with a standard double elimination structure.</li>
      </ul>
    </div>

    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Related Pickleball Tournament Tools on The Pickle Hub
      </h2>
      <p className="text-muted-foreground mb-3">
        Flex Tournament works alongside The Pickle Hub's other tools. Use the right tool for each part of your event:
      </p>
      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
        <li><Link to="/tools/quick-tables" className="text-primary hover:underline">Pickleball bracket generator</Link> — Instant round robin brackets with automatic group balancing for club events.</li>
        <li><Link to="/tools/team-match" className="text-primary hover:underline">Pickleball team match format</Link> — MLP-style team competitions with lineup management and dreambreaker scoring.</li>
        <li><Link to="/tools/doubles-elimination" className="text-primary hover:underline">Double elimination pickleball tournaments</Link> — Professional-grade brackets for large competitive events.</li>
        <li><Link to="/tools" className="text-primary hover:underline">All pickleball tournament tools</Link> — The complete free toolkit for organizing pickleball competitions.</li>
      </ul>
    </div>
  </section>
);
