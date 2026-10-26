/**
 * DUPR rankings snapshot — parsed from www.dupr.com on 2026-10-26.
 *
 * Source pages:
 *   - https://www.dupr.com/rankings (Open + Junior)
 *   - https://www.dupr.com/continental-rankings/{asia,north-america,
 *     south-america,australia-oceania,europe}
 *
 * Each scope has 4 formats (men's singles, women's singles, men's
 * doubles, women's doubles); top 25 per format.
 *
 * Refresh by running scripts/parse-dupr.py and committing the diff.
 * Phase 2 plan: replace with a `dupr-ingest` Supabase edge function +
 * `dupr_rankings` table that the page reads from at runtime.
 */

export type DuprFormat =
  | "mens-singles"
  | "womens-singles"
  | "mens-doubles"
  | "womens-doubles"
  // Sprint A6 (2026-05-27) — vietnam scope formats (aggregated; profiles has
  // no gender column yet so mens/womens cannot be split). Hidden from
  // non-vietnam tabs via getAvailableFormats() below.
  | "singles"
  | "doubles";
export type DuprScope =
  | "open"
  | "junior"
  | "asia"
  | "north-america"
  | "south-america"
  | "australia-oceania"
  | "europe"
  // Sprint A6 (2026-05-27) — national scope, currently Vietnam-only. Reads
  // from public.profiles via dupr_leaderboard_vietnam() RPC at runtime
  // rather than the static const below. UI branches on scope === "vietnam".
  | "vietnam";

export interface DuprPlayer {
  rank: number;
  name: string;
  age: number | null;
  rating: number | null;
}

export const DUPR_RANKINGS: Record<
  Exclude<DuprScope, "vietnam">,
  Record<Exclude<DuprFormat, "singles" | "doubles">, DuprPlayer[]>
> = {
  "open": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "JW Johnson",
        "age": 24,
        "rating": 7.066
      },
      {
        "rank": 2,
        "name": "Ben Johns",
        "age": 27,
        "rating": 7.023
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": 21,
        "rating": 6.905
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": 26,
        "rating": 6.888
      },
      {
        "rank": 5,
        "name": "Andrei Daescu",
        "age": 38,
        "rating": 6.855
      },
      {
        "rank": 6,
        "name": "Gabriel Tardio",
        "age": 21,
        "rating": 6.824
      },
      {
        "rank": 7,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.732
      },
      {
        "rank": 8,
        "name": "Riley Newman",
        "age": 33,
        "rating": 6.674
      },
      {
        "rank": 9,
        "name": "Nicolas Acevedo",
        "age": 27,
        "rating": 6.664
      },
      {
        "rank": 10,
        "name": "Eric Oncins",
        "age": 25,
        "rating": 6.635
      },
      {
        "rank": 11,
        "name": "CJ Klinger",
        "age": 20,
        "rating": 6.62
      },
      {
        "rank": 12,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.551
      },
      {
        "rank": 13,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.509
      },
      {
        "rank": 14,
        "name": "Will Howells",
        "age": 27,
        "rating": 6.487
      },
      {
        "rank": 15,
        "name": "Jay Devilliers",
        "age": 32,
        "rating": 6.457
      },
      {
        "rank": 16,
        "name": "Jack Sock",
        "age": 34,
        "rating": 6.45
      },
      {
        "rank": 17,
        "name": "Dekel Bar",
        "age": 33,
        "rating": 6.444
      },
      {
        "rank": 18,
        "name": "Dylan Frazier",
        "age": 25,
        "rating": 6.425
      },
      {
        "rank": 19,
        "name": "Jaume Martinez Vich",
        "age": 33,
        "rating": 6.4
      },
      {
        "rank": 20,
        "name": "Hunter Johnson",
        "age": 32,
        "rating": 6.396
      },
      {
        "rank": 21,
        "name": "Tyson Mcguffin",
        "age": 37,
        "rating": 6.35
      },
      {
        "rank": 22,
        "name": "John Goins",
        "age": 18,
        "rating": 6.327
      },
      {
        "rank": 23,
        "name": "Pablo Tellez",
        "age": 31,
        "rating": 6.322
      },
      {
        "rank": 24,
        "name": "Roscoe Bellamy",
        "age": 26,
        "rating": 6.318
      },
      {
        "rank": 25,
        "name": "Augustus Ge",
        "age": 30,
        "rating": 6.314
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.976
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": 27,
        "rating": 6.605
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": 25,
        "rating": 6.398
      },
      {
        "rank": 4,
        "name": "Jorja Johnson",
        "age": 20,
        "rating": 6.35
      },
      {
        "rank": 5,
        "name": "Parris Todd",
        "age": 28,
        "rating": 6.328
      },
      {
        "rank": 6,
        "name": "Rachel Rohrabacher",
        "age": 29,
        "rating": 6.292
      },
      {
        "rank": 7,
        "name": "Sofia Sewing",
        "age": 27,
        "rating": 6.192
      },
      {
        "rank": 8,
        "name": "Jackie Kawamoto",
        "age": 30,
        "rating": 6.189
      },
      {
        "rank": 9,
        "name": "Kate Fahey",
        "age": 30,
        "rating": 6.184
      },
      {
        "rank": 10,
        "name": "Tina Pisnik",
        "age": 45,
        "rating": 6.179
      },
      {
        "rank": 11,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 6.157
      },
      {
        "rank": 12,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": 50,
        "rating": 6.153
      },
      {
        "rank": 13,
        "name": "Jade Kawamoto",
        "age": 30,
        "rating": 6.138
      },
      {
        "rank": 14,
        "name": "Mariechristine Salvas",
        "age": 38,
        "rating": 6.121
      },
      {
        "rank": 15,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 6.097
      },
      {
        "rank": 16,
        "name": "Meghan Dizon",
        "age": 33,
        "rating": 6.048
      },
      {
        "rank": 17,
        "name": "Mariana Humberg",
        "age": 30,
        "rating": 6.035
      },
      {
        "rank": 18,
        "name": "Danni-Elle Townsend",
        "age": 23,
        "rating": 6.034
      },
      {
        "rank": 19,
        "name": "Etta Tuionetoa",
        "age": 34,
        "rating": 6.014
      },
      {
        "rank": 20,
        "name": "Lacy Schneemann",
        "age": 30,
        "rating": 6.01
      },
      {
        "rank": 21,
        "name": "Audra Spielberger",
        "age": 55,
        "rating": 6.002
      },
      {
        "rank": 22,
        "name": "Jillian Braverman",
        "age": 37,
        "rating": 5.989
      },
      {
        "rank": 23,
        "name": "Katerina Stewart",
        "age": 29,
        "rating": 5.94
      },
      {
        "rank": 24,
        "name": "Megan Fudge",
        "age": 39,
        "rating": 5.934
      },
      {
        "rank": 25,
        "name": "Bobbi Oshiro",
        "age": 32,
        "rating": 5.921
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Hunter Johnson",
        "age": 32,
        "rating": 6.761
      },
      {
        "rank": 2,
        "name": "Christopher Haworth",
        "age": 33,
        "rating": 6.704
      },
      {
        "rank": 3,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.683
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": 26,
        "rating": 6.542
      },
      {
        "rank": 5,
        "name": "John Goins",
        "age": 18,
        "rating": 6.527
      },
      {
        "rank": 6,
        "name": "Roscoe Bellamy",
        "age": 26,
        "rating": 6.504
      },
      {
        "rank": 7,
        "name": "Jack Sock",
        "age": 34,
        "rating": 6.477
      },
      {
        "rank": 8,
        "name": "Ben Johns",
        "age": 27,
        "rating": 6.437
      },
      {
        "rank": 9,
        "name": "Jaume Martinez Vich",
        "age": 33,
        "rating": 6.431
      },
      {
        "rank": 10,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.404
      },
      {
        "rank": 11,
        "name": "Ammar Wazir",
        "age": 23,
        "rating": 6.385
      },
      {
        "rank": 12,
        "name": "Gabriel Joseph",
        "age": 29,
        "rating": 6.299
      },
      {
        "rank": 13,
        "name": "JW Johnson",
        "age": 24,
        "rating": 6.28
      },
      {
        "rank": 14,
        "name": "Rafael Lenhard",
        "age": 30,
        "rating": 6.27
      },
      {
        "rank": 15,
        "name": "Yates Johnson",
        "age": 32,
        "rating": 6.268
      },
      {
        "rank": 16,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.264
      },
      {
        "rank": 17,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.251
      },
      {
        "rank": 18,
        "name": "Luca Mack",
        "age": 26,
        "rating": 6.25
      },
      {
        "rank": 19,
        "name": "Zane Ford",
        "age": 22,
        "rating": 6.233
      },
      {
        "rank": 20,
        "name": "Adam Harvey",
        "age": 25,
        "rating": 6.228
      },
      {
        "rank": 21,
        "name": "Nam Ly Hoang",
        "age": 29,
        "rating": 6.196
      },
      {
        "rank": 22,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.188
      },
      {
        "rank": 23,
        "name": "Matthew Barlow",
        "age": 32,
        "rating": 6.177
      },
      {
        "rank": 24,
        "name": "Mohaned Alhouni",
        "age": 30,
        "rating": 6.16
      },
      {
        "rank": 25,
        "name": "Dusty Boyer",
        "age": 33,
        "rating": 6.155
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.704
      },
      {
        "rank": 2,
        "name": "Kate Fahey",
        "age": 30,
        "rating": 6.241
      },
      {
        "rank": 3,
        "name": "Katerina Stewart",
        "age": 29,
        "rating": 6.022
      },
      {
        "rank": 4,
        "name": "Kaitlyn Christian",
        "age": 34,
        "rating": 5.906
      },
      {
        "rank": 5,
        "name": "Seone Mendez",
        "age": 27,
        "rating": 5.902
      },
      {
        "rank": 6,
        "name": "Sofia Sewing",
        "age": 27,
        "rating": 5.882
      },
      {
        "rank": 7,
        "name": "Brooke Buckner",
        "age": 34,
        "rating": 5.862
      },
      {
        "rank": 8,
        "name": "Judit Castillo Gargallo",
        "age": 28,
        "rating": 5.81
      },
      {
        "rank": 9,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 5.802
      },
      {
        "rank": 10,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.773
      },
      {
        "rank": 11,
        "name": "Andie Dikosavljevic",
        "age": 30,
        "rating": 5.76
      },
      {
        "rank": 12,
        "name": "Lea Jansen",
        "age": 33,
        "rating": 5.755
      },
      {
        "rank": 13,
        "name": "Sahra Dennehy",
        "age": 24,
        "rating": 5.731
      },
      {
        "rank": 14,
        "name": "Bobbi Oshiro",
        "age": 32,
        "rating": 5.695
      },
      {
        "rank": 15,
        "name": "Domenika Turkovic",
        "age": 26,
        "rating": 5.678
      },
      {
        "rank": 16,
        "name": "Keilly Ulery",
        "age": 36,
        "rating": 5.663
      },
      {
        "rank": 17,
        "name": "Genie Bouchard",
        "age": 32,
        "rating": 5.652
      },
      {
        "rank": 18,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 5.625
      },
      {
        "rank": 19,
        "name": "Marianna Petrei",
        "age": 30,
        "rating": 5.603
      },
      {
        "rank": 20,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.6
      },
      {
        "rank": 21,
        "name": "Yu-Chieh Hsieh",
        "age": 33,
        "rating": 5.598
      },
      {
        "rank": 22,
        "name": "Helena Jansen",
        "age": 27,
        "rating": 5.596
      },
      {
        "rank": 23,
        "name": "Isabella Dunlap",
        "age": 26,
        "rating": 5.596
      },
      {
        "rank": 24,
        "name": "Amber Policare",
        "age": 28,
        "rating": 5.582
      },
      {
        "rank": 25,
        "name": "Maria Vyshkina",
        "age": 22,
        "rating": 5.572
      }
    ]
  },
  "junior": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.327
      },
      {
        "rank": 2,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.159
      },
      {
        "rank": 3,
        "name": "Will Mackinnon",
        "age": 18,
        "rating": 6.101
      },
      {
        "rank": 4,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.086
      },
      {
        "rank": 5,
        "name": "Tristan Dussault",
        "age": 18,
        "rating": 6.07
      },
      {
        "rank": 6,
        "name": "Ben Slive",
        "age": 17,
        "rating": 5.836
      },
      {
        "rank": 7,
        "name": "Francis Chi",
        "age": 14,
        "rating": 5.805
      },
      {
        "rank": 8,
        "name": "Jace Morris",
        "age": 18,
        "rating": 5.8
      },
      {
        "rank": 9,
        "name": "Indy Dagnall",
        "age": 17,
        "rating": 5.794
      },
      {
        "rank": 10,
        "name": "Braden Jacobson",
        "age": 17,
        "rating": 5.766
      },
      {
        "rank": 11,
        "name": "Andrew Caldarella",
        "age": 17,
        "rating": 5.728
      },
      {
        "rank": 12,
        "name": "Ahmad ElZarif",
        "age": 18,
        "rating": 5.72
      },
      {
        "rank": 13,
        "name": "Andre Mercado",
        "age": 17,
        "rating": 5.715
      },
      {
        "rank": 14,
        "name": "Parth Mody",
        "age": 18,
        "rating": 5.711
      },
      {
        "rank": 15,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.701
      },
      {
        "rank": 16,
        "name": "Braylon Ohrel",
        "age": 15,
        "rating": 5.694
      },
      {
        "rank": 17,
        "name": "Arwid Dahlin",
        "age": 18,
        "rating": 5.69
      },
      {
        "rank": 18,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.68
      },
      {
        "rank": 19,
        "name": "Ethan Bakalinsky",
        "age": 15,
        "rating": 5.676
      },
      {
        "rank": 20,
        "name": "Jace Howard",
        "age": 18,
        "rating": 5.651
      },
      {
        "rank": 21,
        "name": "Andrew Angulo",
        "age": 16,
        "rating": 5.537
      },
      {
        "rank": 22,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.525
      },
      {
        "rank": 23,
        "name": "Aj Marrero",
        "age": 18,
        "rating": 5.51
      },
      {
        "rank": 24,
        "name": "Jayce Landheer",
        "age": 18,
        "rating": 5.503
      },
      {
        "rank": 25,
        "name": "Jacob Bolkowy",
        "age": 17,
        "rating": 5.493
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.909
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.735
      },
      {
        "rank": 3,
        "name": "Ella Yeh",
        "age": 16,
        "rating": 5.675
      },
      {
        "rank": 4,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 5.556
      },
      {
        "rank": 5,
        "name": "Averry Chew",
        "age": 18,
        "rating": 5.546
      },
      {
        "rank": 6,
        "name": "Aline Morales",
        "age": 16,
        "rating": 5.528
      },
      {
        "rank": 7,
        "name": "Mary McGowan",
        "age": 18,
        "rating": 5.449
      },
      {
        "rank": 8,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 5.419
      },
      {
        "rank": 9,
        "name": "Jaeda Minniefield",
        "age": 17,
        "rating": 5.402
      },
      {
        "rank": 10,
        "name": "Emma Nelson",
        "age": 16,
        "rating": 5.365
      },
      {
        "rank": 11,
        "name": "Adalynn Lund",
        "age": 17,
        "rating": 5.321
      },
      {
        "rank": 12,
        "name": "Kei Sawaki",
        "age": 16,
        "rating": 5.306
      },
      {
        "rank": 13,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 5.288
      },
      {
        "rank": 14,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 5.244
      },
      {
        "rank": 15,
        "name": "CC Eleven Sacca",
        "age": 15,
        "rating": 5.215
      },
      {
        "rank": 16,
        "name": "Mary Monson",
        "age": 18,
        "rating": 5.195
      },
      {
        "rank": 17,
        "name": "Adelie Osher",
        "age": 18,
        "rating": 5.185
      },
      {
        "rank": 18,
        "name": "Jade Rau",
        "age": 17,
        "rating": 5.174
      },
      {
        "rank": 19,
        "name": "Emily Cho",
        "age": 17,
        "rating": 5.108
      },
      {
        "rank": 20,
        "name": "Naomi Amalsadiwala",
        "age": 17,
        "rating": 5.097
      },
      {
        "rank": 21,
        "name": "Victoria Nguyen",
        "age": 18,
        "rating": 5.085
      },
      {
        "rank": 22,
        "name": "Ella Cosma",
        "age": 17,
        "rating": 5.078
      },
      {
        "rank": 23,
        "name": "Victoria A Simon",
        "age": 16,
        "rating": 5.057
      },
      {
        "rank": 24,
        "name": "Stevie Petropouleas",
        "age": 15,
        "rating": 5.026
      },
      {
        "rank": 25,
        "name": "Ariana Ajani",
        "age": 16,
        "rating": 5.019
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.527
      },
      {
        "rank": 2,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.251
      },
      {
        "rank": 3,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.188
      },
      {
        "rank": 4,
        "name": "Tristan Dussault",
        "age": 18,
        "rating": 6.052
      },
      {
        "rank": 5,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.833
      },
      {
        "rank": 6,
        "name": "Andrew Caldarella",
        "age": 17,
        "rating": 5.641
      },
      {
        "rank": 7,
        "name": "Jace Morris",
        "age": 18,
        "rating": 5.63
      },
      {
        "rank": 8,
        "name": "Indy Dagnall",
        "age": 17,
        "rating": 5.564
      },
      {
        "rank": 9,
        "name": "Ben Herrick",
        "age": 18,
        "rating": 5.561
      },
      {
        "rank": 10,
        "name": "Braylon Ohrel",
        "age": 15,
        "rating": 5.561
      },
      {
        "rank": 11,
        "name": "Braden Jacobson",
        "age": 17,
        "rating": 5.555
      },
      {
        "rank": 12,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.493
      },
      {
        "rank": 13,
        "name": "Hoai Anh Pham",
        "age": 15,
        "rating": 5.467
      },
      {
        "rank": 14,
        "name": "Parth Mody",
        "age": 18,
        "rating": 5.454
      },
      {
        "rank": 15,
        "name": "Wil Shaffer",
        "age": 17,
        "rating": 5.447
      },
      {
        "rank": 16,
        "name": "heyonglin",
        "age": 16,
        "rating": 5.426
      },
      {
        "rank": 17,
        "name": "Ben Slive",
        "age": 17,
        "rating": 5.423
      },
      {
        "rank": 18,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.411
      },
      {
        "rank": 19,
        "name": "Will Mackinnon",
        "age": 18,
        "rating": 5.398
      },
      {
        "rank": 20,
        "name": "Ethan Bakalinsky",
        "age": 15,
        "rating": 5.38
      },
      {
        "rank": 21,
        "name": "Lucas Riffe",
        "age": 16,
        "rating": 5.374
      },
      {
        "rank": 22,
        "name": "Alessio Gabbiani",
        "age": 17,
        "rating": 5.35
      },
      {
        "rank": 23,
        "name": "Dev Shah",
        "age": 18,
        "rating": 5.342
      },
      {
        "rank": 24,
        "name": "Jace Howard",
        "age": 18,
        "rating": 5.337
      },
      {
        "rank": 25,
        "name": "Arwid Dahlin",
        "age": 18,
        "rating": 5.324
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.773
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.6
      },
      {
        "rank": 3,
        "name": "Kei Sawaki",
        "age": 16,
        "rating": 5.337
      },
      {
        "rank": 4,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 5.132
      },
      {
        "rank": 5,
        "name": "Sophia Tran Phuong Anh",
        "age": 18,
        "rating": 5.09
      },
      {
        "rank": 6,
        "name": "Huong Dan Linh",
        "age": 14,
        "rating": 5.059
      },
      {
        "rank": 7,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 5.013
      },
      {
        "rank": 8,
        "name": "Averry Chew",
        "age": 18,
        "rating": 4.979
      },
      {
        "rank": 9,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 4.964
      },
      {
        "rank": 10,
        "name": "Aria Henare",
        "age": 16,
        "rating": 4.903
      },
      {
        "rank": 11,
        "name": "Caroline Maguire",
        "age": 15,
        "rating": 4.894
      },
      {
        "rank": 12,
        "name": "Stella Bảo Châu",
        "age": 15,
        "rating": 4.87
      },
      {
        "rank": 13,
        "name": "Lauren Gosling",
        "age": 16,
        "rating": 4.829
      },
      {
        "rank": 14,
        "name": "Jaeda Minniefield",
        "age": 17,
        "rating": 4.816
      },
      {
        "rank": 15,
        "name": "Jade Rau",
        "age": 17,
        "rating": 4.794
      },
      {
        "rank": 16,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 4.785
      },
      {
        "rank": 17,
        "name": "Niesha  Enja",
        "age": 15,
        "rating": 4.784
      },
      {
        "rank": 18,
        "name": "Lynn Lim",
        "age": 16,
        "rating": 4.753
      },
      {
        "rank": 19,
        "name": "Isadora Campi",
        "age": 18,
        "rating": 4.734
      },
      {
        "rank": 20,
        "name": "Diane Huynh",
        "age": 15,
        "rating": 4.678
      },
      {
        "rank": 21,
        "name": "Eliana Ling",
        "age": 18,
        "rating": 4.636
      },
      {
        "rank": 22,
        "name": "Memory Lelenoa",
        "age": 18,
        "rating": 4.62
      },
      {
        "rank": 23,
        "name": "Natalia Simson",
        "age": 14,
        "rating": 4.62
      },
      {
        "rank": 24,
        "name": "Jing Robinson",
        "age": 15,
        "rating": 4.61
      },
      {
        "rank": 25,
        "name": "Lizzie McFarland",
        "age": 16,
        "rating": 4.555
      }
    ]
  },
  "asia": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 6.272
      },
      {
        "rank": 2,
        "name": "Jonathan Truong",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 3,
        "name": "Yuta Funemizu",
        "age": null,
        "rating": 6.153
      },
      {
        "rank": 4,
        "name": "Quang Duong",
        "age": null,
        "rating": 6.07
      },
      {
        "rank": 5,
        "name": "Len Yang",
        "age": null,
        "rating": 6.068
      },
      {
        "rank": 6,
        "name": "Thomas Yu",
        "age": null,
        "rating": 6.017
      },
      {
        "rank": 7,
        "name": "Kailas Shekar",
        "age": null,
        "rating": 5.936
      },
      {
        "rank": 8,
        "name": "Quan Do",
        "age": null,
        "rating": 5.925
      },
      {
        "rank": 9,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.909
      },
      {
        "rank": 10,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.908
      },
      {
        "rank": 11,
        "name": "Sanil Jagtiani",
        "age": null,
        "rating": 5.888
      },
      {
        "rank": 12,
        "name": "Truong Hien",
        "age": null,
        "rating": 5.888
      },
      {
        "rank": 13,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.876
      },
      {
        "rank": 14,
        "name": "Arnav Duarah",
        "age": null,
        "rating": 5.865
      },
      {
        "rank": 15,
        "name": "Eric Roddy",
        "age": null,
        "rating": 5.858
      },
      {
        "rank": 16,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.85
      },
      {
        "rank": 17,
        "name": "Harsh Mehta",
        "age": null,
        "rating": 5.846
      },
      {
        "rank": 18,
        "name": "Eunggwon Kim",
        "age": null,
        "rating": 5.836
      },
      {
        "rank": 19,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 5.79
      },
      {
        "rank": 20,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.779
      },
      {
        "rank": 21,
        "name": "Rougel Aninon",
        "age": null,
        "rating": 5.778
      },
      {
        "rank": 22,
        "name": "Sarinreach Leng",
        "age": null,
        "rating": 5.748
      },
      {
        "rank": 23,
        "name": "Arjun Singh",
        "age": null,
        "rating": 5.701
      },
      {
        "rank": 24,
        "name": "Ram Kotnana",
        "age": null,
        "rating": 5.696
      },
      {
        "rank": 25,
        "name": "James Yu",
        "age": null,
        "rating": 5.695
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Aibika Kalsarieva",
        "age": null,
        "rating": 5.865
      },
      {
        "rank": 2,
        "name": "Alix Truong",
        "age": null,
        "rating": 5.839
      },
      {
        "rank": 3,
        "name": "Kara Wheatley",
        "age": null,
        "rating": 5.78
      },
      {
        "rank": 4,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.773
      },
      {
        "rank": 5,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.768
      },
      {
        "rank": 6,
        "name": "Marisa Ruiz",
        "age": null,
        "rating": 5.662
      },
      {
        "rank": 7,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.652
      },
      {
        "rank": 8,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.604
      },
      {
        "rank": 9,
        "name": "Nicole Eugenio",
        "age": null,
        "rating": 5.528
      },
      {
        "rank": 10,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.517
      },
      {
        "rank": 11,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.496
      },
      {
        "rank": 12,
        "name": "Natalie Hur",
        "age": null,
        "rating": 5.493
      },
      {
        "rank": 13,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.471
      },
      {
        "rank": 14,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.392
      },
      {
        "rank": 15,
        "name": "Sophia Huỳnh Trần Ngọc Nhi",
        "age": null,
        "rating": 5.389
      },
      {
        "rank": 16,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.388
      },
      {
        "rank": 17,
        "name": "Kai Fen Yi",
        "age": null,
        "rating": 5.383
      },
      {
        "rank": 18,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.378
      },
      {
        "rank": 19,
        "name": "Lyn Yuen Choo",
        "age": null,
        "rating": 5.366
      },
      {
        "rank": 20,
        "name": "Pearl Amalsadiwala",
        "age": null,
        "rating": 5.364
      },
      {
        "rank": 21,
        "name": "Vritti Sethi",
        "age": null,
        "rating": 5.329
      },
      {
        "rank": 22,
        "name": "Ken Tam",
        "age": null,
        "rating": 5.322
      },
      {
        "rank": 23,
        "name": "Dionne Lim",
        "age": null,
        "rating": 5.316
      },
      {
        "rank": 24,
        "name": "Kei Sawaki",
        "age": null,
        "rating": 5.306
      },
      {
        "rank": 25,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.293
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 6.196
      },
      {
        "rank": 2,
        "name": "Phuc Huynh",
        "age": null,
        "rating": 6.07
      },
      {
        "rank": 3,
        "name": "Luc Pham",
        "age": null,
        "rating": 6.011
      },
      {
        "rank": 4,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.935
      },
      {
        "rank": 5,
        "name": "Truong Hien",
        "age": null,
        "rating": 5.931
      },
      {
        "rank": 6,
        "name": "Quang Duong",
        "age": null,
        "rating": 5.915
      },
      {
        "rank": 7,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.892
      },
      {
        "rank": 8,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.879
      },
      {
        "rank": 9,
        "name": "Nasa Hatakeyama",
        "age": null,
        "rating": 5.735
      },
      {
        "rank": 10,
        "name": "jimmy liong kai long",
        "age": null,
        "rating": 5.724
      },
      {
        "rank": 11,
        "name": "nguyễn đắc tiến",
        "age": null,
        "rating": 5.675
      },
      {
        "rank": 12,
        "name": "Sarinreach Leng",
        "age": null,
        "rating": 5.651
      },
      {
        "rank": 13,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.645
      },
      {
        "rank": 14,
        "name": "hoàng nguyễn việt",
        "age": null,
        "rating": 5.599
      },
      {
        "rank": 15,
        "name": "Aditya ruhela",
        "age": null,
        "rating": 5.564
      },
      {
        "rank": 16,
        "name": "Rashein Samuel",
        "age": null,
        "rating": 5.53
      },
      {
        "rank": 17,
        "name": "Aryaan Bhatia",
        "age": null,
        "rating": 5.502
      },
      {
        "rank": 18,
        "name": "Kento Tamaki",
        "age": null,
        "rating": 5.494
      },
      {
        "rank": 19,
        "name": "Vanshik Kapadia",
        "age": null,
        "rating": 5.493
      },
      {
        "rank": 20,
        "name": "Hoai Anh Pham",
        "age": null,
        "rating": 5.467
      },
      {
        "rank": 21,
        "name": "Tuấn Long Phạm",
        "age": null,
        "rating": 5.446
      },
      {
        "rank": 22,
        "name": "Jose Maria Pague",
        "age": null,
        "rating": 5.444
      },
      {
        "rank": 23,
        "name": "Timothy Foo Yi Thim",
        "age": null,
        "rating": 5.437
      },
      {
        "rank": 24,
        "name": "Kenneth Lee",
        "age": null,
        "rating": 5.434
      },
      {
        "rank": 25,
        "name": "heyonglin",
        "age": null,
        "rating": 5.426
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.598
      },
      {
        "rank": 2,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.571
      },
      {
        "rank": 3,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.542
      },
      {
        "rank": 4,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.517
      },
      {
        "rank": 5,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.508
      },
      {
        "rank": 6,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.504
      },
      {
        "rank": 7,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.461
      },
      {
        "rank": 8,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.345
      },
      {
        "rank": 9,
        "name": "Kei Sawaki",
        "age": null,
        "rating": 5.337
      },
      {
        "rank": 10,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.278
      },
      {
        "rank": 11,
        "name": "Alicia Lai",
        "age": null,
        "rating": 5.278
      },
      {
        "rank": 12,
        "name": "aaliya ebrahim",
        "age": null,
        "rating": 5.271
      },
      {
        "rank": 13,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.223
      },
      {
        "rank": 14,
        "name": "Albie Huang",
        "age": null,
        "rating": 5.205
      },
      {
        "rank": 15,
        "name": "Virvienica Bejosano",
        "age": null,
        "rating": 5.195
      },
      {
        "rank": 16,
        "name": "Mihika Yadav",
        "age": null,
        "rating": 5.162
      },
      {
        "rank": 17,
        "name": "Khushi Desai",
        "age": null,
        "rating": 5.12
      },
      {
        "rank": 18,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.114
      },
      {
        "rank": 19,
        "name": "Yunqi He",
        "age": null,
        "rating": 5.093
      },
      {
        "rank": 20,
        "name": "Sophia Tran Phuong Anh",
        "age": null,
        "rating": 5.09
      },
      {
        "rank": 21,
        "name": "Seina Shima",
        "age": null,
        "rating": 5.08
      },
      {
        "rank": 22,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.074
      },
      {
        "rank": 23,
        "name": "Anni Xie",
        "age": null,
        "rating": 5.065
      },
      {
        "rank": 24,
        "name": "Yuet Magdaleine Wong",
        "age": null,
        "rating": 5.064
      },
      {
        "rank": 25,
        "name": "Huong Dan Linh",
        "age": null,
        "rating": 5.059
      }
    ]
  },
  "north-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "JW Johnson",
        "age": null,
        "rating": 7.066
      },
      {
        "rank": 2,
        "name": "Ben Johns",
        "age": null,
        "rating": 7.023
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": null,
        "rating": 6.905
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.888
      },
      {
        "rank": 5,
        "name": "Riley Newman",
        "age": null,
        "rating": 6.674
      },
      {
        "rank": 6,
        "name": "CJ Klinger",
        "age": null,
        "rating": 6.62
      },
      {
        "rank": 7,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.551
      },
      {
        "rank": 8,
        "name": "Will Howells",
        "age": null,
        "rating": 6.487
      },
      {
        "rank": 9,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.45
      },
      {
        "rank": 10,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.425
      },
      {
        "rank": 11,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.396
      },
      {
        "rank": 12,
        "name": "Tyson Mcguffin",
        "age": null,
        "rating": 6.35
      },
      {
        "rank": 13,
        "name": "John Goins",
        "age": null,
        "rating": 6.327
      },
      {
        "rank": 14,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.318
      },
      {
        "rank": 15,
        "name": "Augustus Ge",
        "age": null,
        "rating": 6.314
      },
      {
        "rank": 16,
        "name": "Casey Diamond",
        "age": null,
        "rating": 6.286
      },
      {
        "rank": 17,
        "name": "Blaine Hovenier",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 18,
        "name": "Richard Livornese Jr",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 19,
        "name": "Zane Navratil",
        "age": null,
        "rating": 6.262
      },
      {
        "rank": 20,
        "name": "Jack Munro",
        "age": null,
        "rating": 6.258
      },
      {
        "rank": 21,
        "name": "Travis Rettenmaier",
        "age": null,
        "rating": 6.241
      },
      {
        "rank": 22,
        "name": "Maxwell Freeman",
        "age": null,
        "rating": 6.213
      },
      {
        "rank": 23,
        "name": "Michael Loyd",
        "age": null,
        "rating": 6.213
      },
      {
        "rank": 24,
        "name": "Max Manthou",
        "age": null,
        "rating": 6.207
      },
      {
        "rank": 25,
        "name": "Tyler Loong",
        "age": null,
        "rating": 6.205
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.976
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": null,
        "rating": 6.605
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": null,
        "rating": 6.398
      },
      {
        "rank": 4,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 6.35
      },
      {
        "rank": 5,
        "name": "Parris Todd",
        "age": null,
        "rating": 6.328
      },
      {
        "rank": 6,
        "name": "Rachel Rohrabacher",
        "age": null,
        "rating": 6.292
      },
      {
        "rank": 7,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.192
      },
      {
        "rank": 8,
        "name": "Jackie Kawamoto",
        "age": null,
        "rating": 6.189
      },
      {
        "rank": 9,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.184
      },
      {
        "rank": 10,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 6.157
      },
      {
        "rank": 11,
        "name": "Jade Kawamoto",
        "age": null,
        "rating": 6.138
      },
      {
        "rank": 12,
        "name": "Mariechristine Salvas",
        "age": null,
        "rating": 6.121
      },
      {
        "rank": 13,
        "name": "Meghan Dizon",
        "age": null,
        "rating": 6.048
      },
      {
        "rank": 14,
        "name": "Etta Tuionetoa",
        "age": null,
        "rating": 6.014
      },
      {
        "rank": 15,
        "name": "Lacy Schneemann",
        "age": null,
        "rating": 6.01
      },
      {
        "rank": 16,
        "name": "Audra Spielberger",
        "age": null,
        "rating": 6.002
      },
      {
        "rank": 17,
        "name": "Jillian Braverman",
        "age": null,
        "rating": 5.989
      },
      {
        "rank": 18,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 5.94
      },
      {
        "rank": 19,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.921
      },
      {
        "rank": 20,
        "name": "Vivian Glozman",
        "age": null,
        "rating": 5.915
      },
      {
        "rank": 21,
        "name": "Kiora Kunimoto",
        "age": null,
        "rating": 5.909
      },
      {
        "rank": 22,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.888
      },
      {
        "rank": 23,
        "name": "Lauren Cole",
        "age": null,
        "rating": 5.875
      },
      {
        "rank": 24,
        "name": "Christine Maddox",
        "age": null,
        "rating": 5.869
      },
      {
        "rank": 25,
        "name": "Allison Harris",
        "age": null,
        "rating": 5.857
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.761
      },
      {
        "rank": 2,
        "name": "Christopher Haworth",
        "age": null,
        "rating": 6.704
      },
      {
        "rank": 3,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.542
      },
      {
        "rank": 4,
        "name": "John Goins",
        "age": null,
        "rating": 6.527
      },
      {
        "rank": 5,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.504
      },
      {
        "rank": 6,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.477
      },
      {
        "rank": 7,
        "name": "Ben Johns",
        "age": null,
        "rating": 6.437
      },
      {
        "rank": 8,
        "name": "Ammar Wazir",
        "age": null,
        "rating": 6.385
      },
      {
        "rank": 9,
        "name": "Gabriel Joseph",
        "age": null,
        "rating": 6.299
      },
      {
        "rank": 10,
        "name": "JW Johnson",
        "age": null,
        "rating": 6.28
      },
      {
        "rank": 11,
        "name": "Yates Johnson",
        "age": null,
        "rating": 6.268
      },
      {
        "rank": 12,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.264
      },
      {
        "rank": 13,
        "name": "Tama Shimabukuro",
        "age": null,
        "rating": 6.251
      },
      {
        "rank": 14,
        "name": "Zane Ford",
        "age": null,
        "rating": 6.233
      },
      {
        "rank": 15,
        "name": "Adam Harvey",
        "age": null,
        "rating": 6.228
      },
      {
        "rank": 16,
        "name": "Camden Chaffin",
        "age": null,
        "rating": 6.188
      },
      {
        "rank": 17,
        "name": "Matthew Barlow",
        "age": null,
        "rating": 6.177
      },
      {
        "rank": 18,
        "name": "Dusty Boyer",
        "age": null,
        "rating": 6.155
      },
      {
        "rank": 19,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.117
      },
      {
        "rank": 20,
        "name": "Cason Campbell",
        "age": null,
        "rating": 6.107
      },
      {
        "rank": 21,
        "name": "Connor Mogle",
        "age": null,
        "rating": 6.099
      },
      {
        "rank": 22,
        "name": "Youssef Bouzidi",
        "age": null,
        "rating": 6.079
      },
      {
        "rank": 23,
        "name": "Augustus Ge",
        "age": null,
        "rating": 6.075
      },
      {
        "rank": 24,
        "name": "Ronan Camron",
        "age": null,
        "rating": 6.057
      },
      {
        "rank": 25,
        "name": "Tristan Dussault",
        "age": null,
        "rating": 6.052
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.704
      },
      {
        "rank": 2,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.241
      },
      {
        "rank": 3,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 6.022
      },
      {
        "rank": 4,
        "name": "Kaitlyn Christian",
        "age": null,
        "rating": 5.906
      },
      {
        "rank": 5,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 5.882
      },
      {
        "rank": 6,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.862
      },
      {
        "rank": 7,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.81
      },
      {
        "rank": 8,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 5.802
      },
      {
        "rank": 9,
        "name": "Kiora Kunimoto",
        "age": null,
        "rating": 5.773
      },
      {
        "rank": 10,
        "name": "Lea Jansen",
        "age": null,
        "rating": 5.755
      },
      {
        "rank": 11,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.695
      },
      {
        "rank": 12,
        "name": "Keilly Ulery",
        "age": null,
        "rating": 5.663
      },
      {
        "rank": 13,
        "name": "Genie Bouchard",
        "age": null,
        "rating": 5.652
      },
      {
        "rank": 14,
        "name": "Cailyn Campbell",
        "age": null,
        "rating": 5.6
      },
      {
        "rank": 15,
        "name": "Isabella Dunlap",
        "age": null,
        "rating": 5.596
      },
      {
        "rank": 16,
        "name": "Amber Policare",
        "age": null,
        "rating": 5.582
      },
      {
        "rank": 17,
        "name": "Maria Vyshkina",
        "age": null,
        "rating": 5.55
      },
      {
        "rank": 18,
        "name": "Jessica Ho",
        "age": null,
        "rating": 5.545
      },
      {
        "rank": 19,
        "name": "Eileen Wang",
        "age": null,
        "rating": 5.517
      },
      {
        "rank": 20,
        "name": "Liz Truluck",
        "age": null,
        "rating": 5.502
      },
      {
        "rank": 21,
        "name": "Jada Bui",
        "age": null,
        "rating": 5.463
      },
      {
        "rank": 22,
        "name": "Karin Ptaszek-Kochis",
        "age": null,
        "rating": 5.457
      },
      {
        "rank": 23,
        "name": "Hannah Blatt",
        "age": null,
        "rating": 5.435
      },
      {
        "rank": 24,
        "name": "Jalina Ingram",
        "age": null,
        "rating": 5.427
      },
      {
        "rank": 25,
        "name": "Jessica Evanier",
        "age": null,
        "rating": 5.376
      }
    ]
  },
  "south-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Gabriel Tardio",
        "age": null,
        "rating": 6.824
      },
      {
        "rank": 2,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.732
      },
      {
        "rank": 3,
        "name": "Nicolas Acevedo",
        "age": null,
        "rating": 6.664
      },
      {
        "rank": 4,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.635
      },
      {
        "rank": 5,
        "name": "Pablo Tellez",
        "age": null,
        "rating": 6.322
      },
      {
        "rank": 6,
        "name": "Bruno Faletto",
        "age": null,
        "rating": 6.259
      },
      {
        "rank": 7,
        "name": "Jaime Oncins",
        "age": null,
        "rating": 6.135
      },
      {
        "rank": 8,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.096
      },
      {
        "rank": 9,
        "name": "Andre Millet",
        "age": null,
        "rating": 6.02
      },
      {
        "rank": 10,
        "name": "James Delgado",
        "age": null,
        "rating": 6.015
      },
      {
        "rank": 11,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.952
      },
      {
        "rank": 12,
        "name": "Mario Barrientos",
        "age": null,
        "rating": 5.82
      },
      {
        "rank": 13,
        "name": "Carlos Di Laura",
        "age": null,
        "rating": 5.781
      },
      {
        "rank": 14,
        "name": "Patricio Pereyra",
        "age": null,
        "rating": 5.749
      },
      {
        "rank": 15,
        "name": "Kevin Dayan",
        "age": null,
        "rating": 5.636
      },
      {
        "rank": 16,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.596
      },
      {
        "rank": 17,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.535
      },
      {
        "rank": 18,
        "name": "Miguel Alda",
        "age": null,
        "rating": 5.524
      },
      {
        "rank": 19,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 5.505
      },
      {
        "rank": 20,
        "name": "Tobias Golberg",
        "age": null,
        "rating": 5.497
      },
      {
        "rank": 21,
        "name": "Mario Porcelli",
        "age": null,
        "rating": 5.421
      },
      {
        "rank": 22,
        "name": "Juan Medina",
        "age": null,
        "rating": 5.417
      },
      {
        "rank": 23,
        "name": "Federico Nani",
        "age": null,
        "rating": 5.414
      },
      {
        "rank": 24,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.4
      },
      {
        "rank": 25,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.395
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 6.153
      },
      {
        "rank": 2,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 6.035
      },
      {
        "rank": 3,
        "name": "Lucia White",
        "age": null,
        "rating": 5.651
      },
      {
        "rank": 4,
        "name": "Alexa Quintanilla",
        "age": null,
        "rating": 5.493
      },
      {
        "rank": 5,
        "name": "Pierina Imparato",
        "age": null,
        "rating": 5.424
      },
      {
        "rank": 6,
        "name": "Gabriela Katz",
        "age": null,
        "rating": 5.404
      },
      {
        "rank": 7,
        "name": "Namie Isago",
        "age": null,
        "rating": 5.349
      },
      {
        "rank": 8,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 5.273
      },
      {
        "rank": 9,
        "name": "Carolina Mayorga Perry",
        "age": null,
        "rating": 5.211
      },
      {
        "rank": 10,
        "name": "Nicole Lange Beidacki",
        "age": null,
        "rating": 5.162
      },
      {
        "rank": 11,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.077
      },
      {
        "rank": 12,
        "name": "Bequi Barros Behar Luizelli",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 13,
        "name": "Ali Quintero",
        "age": null,
        "rating": 5.015
      },
      {
        "rank": 14,
        "name": "Tatiana Ruhl",
        "age": null,
        "rating": 5.011
      },
      {
        "rank": 15,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.995
      },
      {
        "rank": 16,
        "name": "Dayana Fahey",
        "age": null,
        "rating": 4.988
      },
      {
        "rank": 17,
        "name": "Eliza de Oliveira Rocha",
        "age": null,
        "rating": 4.96
      },
      {
        "rank": 18,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.947
      },
      {
        "rank": 19,
        "name": "patricia medrado",
        "age": null,
        "rating": 4.926
      },
      {
        "rank": 20,
        "name": "Arianna Raga",
        "age": null,
        "rating": 4.854
      },
      {
        "rank": 21,
        "name": "Lina Romero Alarcon",
        "age": null,
        "rating": 4.787
      },
      {
        "rank": 22,
        "name": "Mariana Paredes",
        "age": null,
        "rating": 4.746
      },
      {
        "rank": 23,
        "name": "Marcelle Prates",
        "age": null,
        "rating": 4.734
      },
      {
        "rank": 24,
        "name": "Katie Neils",
        "age": null,
        "rating": 4.698
      },
      {
        "rank": 25,
        "name": "Joana Amorim Cortez dos Santos",
        "age": null,
        "rating": 4.673
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.683
      },
      {
        "rank": 2,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.27
      },
      {
        "rank": 3,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.143
      },
      {
        "rank": 4,
        "name": "Andre Millet",
        "age": null,
        "rating": 6.09
      },
      {
        "rank": 5,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.631
      },
      {
        "rank": 6,
        "name": "James Delgado",
        "age": null,
        "rating": 5.594
      },
      {
        "rank": 7,
        "name": "Nicolas Almeida",
        "age": null,
        "rating": 5.498
      },
      {
        "rank": 8,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.472
      },
      {
        "rank": 9,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.402
      },
      {
        "rank": 10,
        "name": "Mario Porcelli",
        "age": null,
        "rating": 5.396
      },
      {
        "rank": 11,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.382
      },
      {
        "rank": 12,
        "name": "Nicolas Yannuzzi",
        "age": null,
        "rating": 5.302
      },
      {
        "rank": 13,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.228
      },
      {
        "rank": 14,
        "name": "ayke Rodrigues",
        "age": null,
        "rating": 5.216
      },
      {
        "rank": 15,
        "name": "Caio Silva",
        "age": null,
        "rating": 5.194
      },
      {
        "rank": 16,
        "name": "Cristobal Del Castillo",
        "age": null,
        "rating": 5.15
      },
      {
        "rank": 17,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 5.131
      },
      {
        "rank": 18,
        "name": "Gabriel Weffort hilbert",
        "age": null,
        "rating": 5.12
      },
      {
        "rank": 19,
        "name": "THIAGO SOTO",
        "age": null,
        "rating": 5.114
      },
      {
        "rank": 20,
        "name": "João Pedro Agulha Fernandes",
        "age": null,
        "rating": 5.109
      },
      {
        "rank": 21,
        "name": "Bruno Semino",
        "age": null,
        "rating": 5.087
      },
      {
        "rank": 22,
        "name": "Juan Pablo Pinilla",
        "age": null,
        "rating": 5.085
      },
      {
        "rank": 23,
        "name": "Bernardo Valdes",
        "age": null,
        "rating": 5.068
      },
      {
        "rank": 24,
        "name": "Tony Ottamendi",
        "age": null,
        "rating": 5.028
      },
      {
        "rank": 25,
        "name": "Rodrigo Borrero",
        "age": null,
        "rating": 5.017
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 5.412
      },
      {
        "rank": 2,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 5.336
      },
      {
        "rank": 3,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.161
      },
      {
        "rank": 4,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.916
      },
      {
        "rank": 5,
        "name": "Camila Militao",
        "age": null,
        "rating": 4.761
      },
      {
        "rank": 6,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 4.739
      },
      {
        "rank": 7,
        "name": "Isadora Campi",
        "age": null,
        "rating": 4.734
      },
      {
        "rank": 8,
        "name": "Genesis Pinto",
        "age": null,
        "rating": 4.626
      },
      {
        "rank": 9,
        "name": "Sofia Kelbert",
        "age": null,
        "rating": 4.618
      },
      {
        "rank": 10,
        "name": "Ana Sánchez",
        "age": null,
        "rating": 4.598
      },
      {
        "rank": 11,
        "name": "Giovanna Mandon Grigioni",
        "age": null,
        "rating": 4.538
      },
      {
        "rank": 12,
        "name": "Sofia Daniela Rodriguez Camejo",
        "age": null,
        "rating": 4.488
      },
      {
        "rank": 13,
        "name": "Míria Nascimento",
        "age": null,
        "rating": 4.474
      },
      {
        "rank": 14,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.402
      },
      {
        "rank": 15,
        "name": "Mia Alva",
        "age": null,
        "rating": 4.381
      },
      {
        "rank": 16,
        "name": "Delfina Debenedetti",
        "age": null,
        "rating": 4.336
      },
      {
        "rank": 17,
        "name": "Cristina Verta",
        "age": null,
        "rating": 4.268
      },
      {
        "rank": 18,
        "name": "carolina ledesma",
        "age": null,
        "rating": 4.266
      },
      {
        "rank": 19,
        "name": "Ana Julia Menon Bosso",
        "age": null,
        "rating": 4.25
      },
      {
        "rank": 20,
        "name": "Valeria Mayta",
        "age": null,
        "rating": 4.162
      },
      {
        "rank": 21,
        "name": "Mariana Negreiros Mariano",
        "age": null,
        "rating": 4.055
      },
      {
        "rank": 22,
        "name": "Giulia Candeloro",
        "age": null,
        "rating": 4.05
      },
      {
        "rank": 23,
        "name": "Monica Perez",
        "age": null,
        "rating": 4.034
      },
      {
        "rank": 24,
        "name": "Roberta Seidl",
        "age": null,
        "rating": 4.032
      },
      {
        "rank": 25,
        "name": "Viviane Rentroia",
        "age": null,
        "rating": 4.019
      }
    ]
  },
  "australia-oceania": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "George Wall",
        "age": null,
        "rating": 6.018
      },
      {
        "rank": 2,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.962
      },
      {
        "rank": 3,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.862
      },
      {
        "rank": 4,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.721
      },
      {
        "rank": 5,
        "name": "Andre Mick",
        "age": null,
        "rating": 5.7
      },
      {
        "rank": 6,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.694
      },
      {
        "rank": 7,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.647
      },
      {
        "rank": 8,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.613
      },
      {
        "rank": 9,
        "name": "Morgan Evans",
        "age": null,
        "rating": 5.594
      },
      {
        "rank": 10,
        "name": "Robert Claveria Stirling",
        "age": null,
        "rating": 5.562
      },
      {
        "rank": 11,
        "name": "Brian Tran",
        "age": null,
        "rating": 5.489
      },
      {
        "rank": 12,
        "name": "Tristan Stayt",
        "age": null,
        "rating": 5.488
      },
      {
        "rank": 13,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.463
      },
      {
        "rank": 14,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.421
      },
      {
        "rank": 15,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 5.367
      },
      {
        "rank": 16,
        "name": "ethan butson",
        "age": null,
        "rating": 5.346
      },
      {
        "rank": 17,
        "name": "Ciaran Lavers",
        "age": null,
        "rating": 5.311
      },
      {
        "rank": 18,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.29
      },
      {
        "rank": 19,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.278
      },
      {
        "rank": 20,
        "name": "Joshua Nipperess",
        "age": null,
        "rating": 5.274
      },
      {
        "rank": 21,
        "name": "Jason William Taylor",
        "age": null,
        "rating": 5.265
      },
      {
        "rank": 22,
        "name": "Chris Turvey",
        "age": null,
        "rating": 5.259
      },
      {
        "rank": 23,
        "name": "Andrew Kratzmann",
        "age": null,
        "rating": 5.245
      },
      {
        "rank": 24,
        "name": "Andy van der Vyver",
        "age": null,
        "rating": 5.238
      },
      {
        "rank": 25,
        "name": "Ben Dawson",
        "age": null,
        "rating": 5.236
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 6.034
      },
      {
        "rank": 2,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.908
      },
      {
        "rank": 3,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.814
      },
      {
        "rank": 4,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.753
      },
      {
        "rank": 5,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.728
      },
      {
        "rank": 6,
        "name": "Kelsey Grambeau",
        "age": null,
        "rating": 5.709
      },
      {
        "rank": 7,
        "name": "Somer DallaBona",
        "age": null,
        "rating": 5.663
      },
      {
        "rank": 8,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.618
      },
      {
        "rank": 9,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.597
      },
      {
        "rank": 10,
        "name": "Talia Saunders",
        "age": null,
        "rating": 5.528
      },
      {
        "rank": 11,
        "name": "Sarah Burr",
        "age": null,
        "rating": 5.398
      },
      {
        "rank": 12,
        "name": "Brittany Yang",
        "age": null,
        "rating": 5.328
      },
      {
        "rank": 13,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 5.326
      },
      {
        "rank": 14,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.279
      },
      {
        "rank": 15,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.266
      },
      {
        "rank": 16,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 5.231
      },
      {
        "rank": 17,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 5.145
      },
      {
        "rank": 18,
        "name": "Katerina Valos",
        "age": null,
        "rating": 5.131
      },
      {
        "rank": 19,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 5.128
      },
      {
        "rank": 20,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.105
      },
      {
        "rank": 21,
        "name": "Karen Denman",
        "age": null,
        "rating": 5.039
      },
      {
        "rank": 22,
        "name": "Tyra Calderwood",
        "age": null,
        "rating": 5.027
      },
      {
        "rank": 23,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 5.007
      },
      {
        "rank": 24,
        "name": "Tayah Cross",
        "age": null,
        "rating": 4.961
      },
      {
        "rank": 25,
        "name": "Nancy Ferguson",
        "age": null,
        "rating": 4.956
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.967
      },
      {
        "rank": 2,
        "name": "Robbie lee",
        "age": null,
        "rating": 5.852
      },
      {
        "rank": 3,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.637
      },
      {
        "rank": 4,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.483
      },
      {
        "rank": 5,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.48
      },
      {
        "rank": 6,
        "name": "Andy van der Vyver",
        "age": null,
        "rating": 5.463
      },
      {
        "rank": 7,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.394
      },
      {
        "rank": 8,
        "name": "Brian Tran",
        "age": null,
        "rating": 5.366
      },
      {
        "rank": 9,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.346
      },
      {
        "rank": 10,
        "name": "Matthew Kouznetsov",
        "age": null,
        "rating": 5.313
      },
      {
        "rank": 11,
        "name": "Ryan Lee",
        "age": null,
        "rating": 5.308
      },
      {
        "rank": 12,
        "name": "Ethan Chung",
        "age": null,
        "rating": 5.293
      },
      {
        "rank": 13,
        "name": "Sam Aslanowicz",
        "age": null,
        "rating": 5.264
      },
      {
        "rank": 14,
        "name": "Michael Massih",
        "age": null,
        "rating": 5.264
      },
      {
        "rank": 15,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.212
      },
      {
        "rank": 16,
        "name": "Joshua Barber",
        "age": null,
        "rating": 5.17
      },
      {
        "rank": 17,
        "name": "James Wilson",
        "age": null,
        "rating": 5.156
      },
      {
        "rank": 18,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.15
      },
      {
        "rank": 19,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.142
      },
      {
        "rank": 20,
        "name": "Kyron Pinter",
        "age": null,
        "rating": 5.121
      },
      {
        "rank": 21,
        "name": "feiloakitohi Tavalea",
        "age": null,
        "rating": 5.102
      },
      {
        "rank": 22,
        "name": "Nicholas Maleganeas",
        "age": null,
        "rating": 5.086
      },
      {
        "rank": 23,
        "name": "Nigel Lee",
        "age": null,
        "rating": 5.062
      },
      {
        "rank": 24,
        "name": "Sam Gibbs",
        "age": null,
        "rating": 5.058
      },
      {
        "rank": 25,
        "name": "Ben Murace",
        "age": null,
        "rating": 5.041
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.902
      },
      {
        "rank": 2,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.76
      },
      {
        "rank": 3,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.731
      },
      {
        "rank": 4,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.435
      },
      {
        "rank": 5,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.389
      },
      {
        "rank": 6,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.304
      },
      {
        "rank": 7,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 5.27
      },
      {
        "rank": 8,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.251
      },
      {
        "rank": 9,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 5.126
      },
      {
        "rank": 10,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.104
      },
      {
        "rank": 11,
        "name": "Jasmine Almaguer",
        "age": null,
        "rating": 5.096
      },
      {
        "rank": 12,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 13,
        "name": "Brittany Yang",
        "age": null,
        "rating": 4.993
      },
      {
        "rank": 14,
        "name": "Katerina Valos",
        "age": null,
        "rating": 4.988
      },
      {
        "rank": 15,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 4.969
      },
      {
        "rank": 16,
        "name": "Nives Baric",
        "age": null,
        "rating": 4.961
      },
      {
        "rank": 17,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 4.936
      },
      {
        "rank": 18,
        "name": "Aria Henare",
        "age": null,
        "rating": 4.903
      },
      {
        "rank": 19,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 4.902
      },
      {
        "rank": 20,
        "name": "Karen Denman",
        "age": null,
        "rating": 4.875
      },
      {
        "rank": 21,
        "name": "Ange Green",
        "age": null,
        "rating": 4.867
      },
      {
        "rank": 22,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 4.822
      },
      {
        "rank": 23,
        "name": "Tayah Cross",
        "age": null,
        "rating": 4.742
      },
      {
        "rank": 24,
        "name": "Louise Oxnevad",
        "age": null,
        "rating": 4.731
      },
      {
        "rank": 25,
        "name": "Hikaru Han",
        "age": null,
        "rating": 4.716
      }
    ]
  },
  "europe": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Andrei Daescu",
        "age": null,
        "rating": 6.855
      },
      {
        "rank": 2,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.509
      },
      {
        "rank": 3,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 6.457
      },
      {
        "rank": 4,
        "name": "Dekel Bar",
        "age": null,
        "rating": 6.444
      },
      {
        "rank": 5,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.4
      },
      {
        "rank": 6,
        "name": "Martin Emmrich",
        "age": null,
        "rating": 6.191
      },
      {
        "rank": 7,
        "name": "DJ Young",
        "age": null,
        "rating": 6.123
      },
      {
        "rank": 8,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 6.104
      },
      {
        "rank": 9,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.075
      },
      {
        "rank": 10,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 6.058
      },
      {
        "rank": 11,
        "name": "Oscar Serra",
        "age": null,
        "rating": 6.045
      },
      {
        "rank": 12,
        "name": "Tom Protzek",
        "age": null,
        "rating": 6.015
      },
      {
        "rank": 13,
        "name": "Patrick Smith",
        "age": null,
        "rating": 5.953
      },
      {
        "rank": 14,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.933
      },
      {
        "rank": 15,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.898
      },
      {
        "rank": 16,
        "name": "Jaime Lladro",
        "age": null,
        "rating": 5.86
      },
      {
        "rank": 17,
        "name": "Martin Stanchev",
        "age": null,
        "rating": 5.817
      },
      {
        "rank": 18,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 5.814
      },
      {
        "rank": 19,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.81
      },
      {
        "rank": 20,
        "name": "Alvaro Regalado",
        "age": null,
        "rating": 5.795
      },
      {
        "rank": 21,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.755
      },
      {
        "rank": 22,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.749
      },
      {
        "rank": 23,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.749
      },
      {
        "rank": 24,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.733
      },
      {
        "rank": 25,
        "name": "Domenico Geminiani",
        "age": null,
        "rating": 5.732
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Tina Pisnik",
        "age": null,
        "rating": 6.179
      },
      {
        "rank": 2,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 6.097
      },
      {
        "rank": 3,
        "name": "Megan Fudge",
        "age": null,
        "rating": 5.934
      },
      {
        "rank": 4,
        "name": "Ewa Radzikowska",
        "age": null,
        "rating": 5.896
      },
      {
        "rank": 5,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.821
      },
      {
        "rank": 6,
        "name": "Estee widdershoven",
        "age": null,
        "rating": 5.761
      },
      {
        "rank": 7,
        "name": "Daria Walczak",
        "age": null,
        "rating": 5.754
      },
      {
        "rank": 8,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.729
      },
      {
        "rank": 9,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.689
      },
      {
        "rank": 10,
        "name": "Paula Rives Palau",
        "age": null,
        "rating": 5.68
      },
      {
        "rank": 11,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.616
      },
      {
        "rank": 12,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 13,
        "name": "Andrea Olson",
        "age": null,
        "rating": 5.598
      },
      {
        "rank": 14,
        "name": "Lucy Kovalova",
        "age": null,
        "rating": 5.597
      },
      {
        "rank": 15,
        "name": "Martina Frantova",
        "age": null,
        "rating": 5.568
      },
      {
        "rank": 16,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.561
      },
      {
        "rank": 17,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.519
      },
      {
        "rank": 18,
        "name": "Molly ODonoghue",
        "age": null,
        "rating": 5.517
      },
      {
        "rank": 19,
        "name": "Glauka Carvajal Lane",
        "age": null,
        "rating": 5.479
      },
      {
        "rank": 20,
        "name": "Maria Klokotzky",
        "age": null,
        "rating": 5.479
      },
      {
        "rank": 21,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 5.423
      },
      {
        "rank": 22,
        "name": "Tea Pejic",
        "age": null,
        "rating": 5.413
      },
      {
        "rank": 23,
        "name": "Giorgia Vitale",
        "age": null,
        "rating": 5.412
      },
      {
        "rank": 24,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.408
      },
      {
        "rank": 25,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.377
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.431
      },
      {
        "rank": 2,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.404
      },
      {
        "rank": 3,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.25
      },
      {
        "rank": 4,
        "name": "Tom Protzek",
        "age": null,
        "rating": 6.033
      },
      {
        "rank": 5,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 6.027
      },
      {
        "rank": 6,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 5.952
      },
      {
        "rank": 7,
        "name": "Matthew Finnerty",
        "age": null,
        "rating": 5.943
      },
      {
        "rank": 8,
        "name": "Emilien Burnel",
        "age": null,
        "rating": 5.928
      },
      {
        "rank": 9,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.927
      },
      {
        "rank": 10,
        "name": "Martin Stanchev",
        "age": null,
        "rating": 5.925
      },
      {
        "rank": 11,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.89
      },
      {
        "rank": 12,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.74
      },
      {
        "rank": 13,
        "name": "Claudio Quinones Garcia",
        "age": null,
        "rating": 5.732
      },
      {
        "rank": 14,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 5.716
      },
      {
        "rank": 15,
        "name": "James Chaudry",
        "age": null,
        "rating": 5.695
      },
      {
        "rank": 16,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.69
      },
      {
        "rank": 17,
        "name": "ignasi de rueda",
        "age": null,
        "rating": 5.681
      },
      {
        "rank": 18,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.671
      },
      {
        "rank": 19,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.663
      },
      {
        "rank": 20,
        "name": "vasyl yazadzhiev",
        "age": null,
        "rating": 5.645
      },
      {
        "rank": 21,
        "name": "Mikołaj Biedermann",
        "age": null,
        "rating": 5.599
      },
      {
        "rank": 22,
        "name": "Bartosz Karbownik",
        "age": null,
        "rating": 5.599
      },
      {
        "rank": 23,
        "name": "Mauro Garcia Sanchez",
        "age": null,
        "rating": 5.597
      },
      {
        "rank": 24,
        "name": "Mikar Fisher",
        "age": null,
        "rating": 5.595
      },
      {
        "rank": 25,
        "name": "James Ling",
        "age": null,
        "rating": 5.545
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.678
      },
      {
        "rank": 2,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 5.625
      },
      {
        "rank": 3,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 4,
        "name": "Helena Jansen",
        "age": null,
        "rating": 5.596
      },
      {
        "rank": 5,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.525
      },
      {
        "rank": 6,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.44
      },
      {
        "rank": 7,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.37
      },
      {
        "rank": 8,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.306
      },
      {
        "rank": 9,
        "name": "Caroline Nothnagel",
        "age": null,
        "rating": 5.295
      },
      {
        "rank": 10,
        "name": "Katie Morris",
        "age": null,
        "rating": 5.262
      },
      {
        "rank": 11,
        "name": "Francesca Rumi",
        "age": null,
        "rating": 5.237
      },
      {
        "rank": 12,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.215
      },
      {
        "rank": 13,
        "name": "Naomi de Hart",
        "age": null,
        "rating": 5.191
      },
      {
        "rank": 14,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.172
      },
      {
        "rank": 15,
        "name": "Estee widdershoven",
        "age": null,
        "rating": 5.169
      },
      {
        "rank": 16,
        "name": "Pialena Ander",
        "age": null,
        "rating": 5.163
      },
      {
        "rank": 17,
        "name": "Emilia Richter",
        "age": null,
        "rating": 5.141
      },
      {
        "rank": 18,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.063
      },
      {
        "rank": 19,
        "name": "Myriam ENMER",
        "age": null,
        "rating": 5.053
      },
      {
        "rank": 20,
        "name": "Maria Fernandez Costantino",
        "age": null,
        "rating": 5.041
      },
      {
        "rank": 21,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 4.995
      },
      {
        "rank": 22,
        "name": "Frida Mudsam",
        "age": null,
        "rating": 4.988
      },
      {
        "rank": 23,
        "name": "Marina Alcaide",
        "age": null,
        "rating": 4.967
      },
      {
        "rank": 24,
        "name": "Claudia Caymel",
        "age": null,
        "rating": 4.954
      },
      {
        "rank": 25,
        "name": "Paola Tampieri",
        "age": null,
        "rating": 4.929
      }
    ]
  }
};


export type DuprScopeGroup = "global" | "continent" | "national";

export const DUPR_SCOPES: { key: DuprScope; labelEn: string; labelVi: string; group: DuprScopeGroup }[] = [
  // National scope first — most prominent for the ~95% Vietnamese userbase.
  { key: "vietnam",           labelEn: "Vietnam",             labelVi: "Việt Nam",        group: "national" },
  { key: "open",              labelEn: "Open",                labelVi: "Mở rộng",         group: "global" },
  { key: "junior",            labelEn: "Junior",              labelVi: "Trẻ",             group: "global" },
  { key: "asia",              labelEn: "Asia",                labelVi: "Châu Á",          group: "continent" },
  { key: "north-america",     labelEn: "North America",       labelVi: "Bắc Mỹ",          group: "continent" },
  { key: "south-america",     labelEn: "South America",       labelVi: "Nam Mỹ",          group: "continent" },
  { key: "australia-oceania", labelEn: "Australia / Oceania", labelVi: "Úc / Châu Đại Dương", group: "continent" },
  { key: "europe",            labelEn: "Europe",              labelVi: "Châu Âu",         group: "continent" },
];

export const DUPR_FORMATS: { key: DuprFormat; labelEn: string; labelVi: string }[] = [
  { key: "mens-singles",   labelEn: "Men's Singles",   labelVi: "Đơn nam" },
  { key: "womens-singles", labelEn: "Women's Singles", labelVi: "Đơn nữ" },
  { key: "mens-doubles",   labelEn: "Men's Doubles",   labelVi: "Đôi nam" },
  { key: "womens-doubles", labelEn: "Women's Doubles", labelVi: "Đôi nữ" },
  { key: "singles",        labelEn: "Singles",         labelVi: "Đơn" },
  { key: "doubles",        labelEn: "Doubles",         labelVi: "Đôi" },
];

// Sprint A6 — per-scope format availability. vietnam uses 2 aggregated
// formats; all other scopes use the 4 gender-split formats.
export function getAvailableFormats(scope: DuprScope): DuprFormat[] {
  if (scope === "vietnam") {
    return ["doubles", "singles"];
  }
  return ["mens-singles", "womens-singles", "mens-doubles", "womens-doubles"];
}

export function defaultFormatForScope(scope: DuprScope): DuprFormat {
  return scope === "vietnam" ? "doubles" : "mens-doubles";
}

export const DUPR_LAST_UPDATED = "2026-10-26";
