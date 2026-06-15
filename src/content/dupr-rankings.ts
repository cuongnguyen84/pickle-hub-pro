/**
 * DUPR rankings snapshot — parsed from www.dupr.com on 2026-06-15.
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

export const DUPR_RANKINGS: Record<DuprScope, Record<DuprFormat, DuprPlayer[]>> = {
  "open": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Ben Johns",
        "age": 27,
        "rating": 7.126
      },
      {
        "rank": 2,
        "name": "JW Johnson",
        "age": 24,
        "rating": 7.021
      },
      {
        "rank": 3,
        "name": "Andrei Daescu",
        "age": 37,
        "rating": 6.951
      },
      {
        "rank": 4,
        "name": "Hayden Patriquin",
        "age": 20,
        "rating": 6.904
      },
      {
        "rank": 5,
        "name": "Gabriel Tardio",
        "age": 20,
        "rating": 6.862
      },
      {
        "rank": 6,
        "name": "Christian Alshon",
        "age": 25,
        "rating": 6.858
      },
      {
        "rank": 7,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.711
      },
      {
        "rank": 8,
        "name": "Riley Newman",
        "age": 32,
        "rating": 6.681
      },
      {
        "rank": 9,
        "name": "CJ Klinger",
        "age": 20,
        "rating": 6.651
      },
      {
        "rank": 10,
        "name": "Jay Devilliers",
        "age": 31,
        "rating": 6.637
      },
      {
        "rank": 11,
        "name": "Will Howells",
        "age": 27,
        "rating": 6.621
      },
      {
        "rank": 12,
        "name": "Nicolas Acevedo",
        "age": 26,
        "rating": 6.62
      },
      {
        "rank": 13,
        "name": "Eric Oncins",
        "age": 24,
        "rating": 6.617
      },
      {
        "rank": 14,
        "name": "James Ignatowich",
        "age": 26,
        "rating": 6.585
      },
      {
        "rank": 15,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.575
      },
      {
        "rank": 16,
        "name": "Dekel Bar",
        "age": 33,
        "rating": 6.574
      },
      {
        "rank": 17,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.549
      },
      {
        "rank": 18,
        "name": "Jack Sock",
        "age": 33,
        "rating": 6.514
      },
      {
        "rank": 19,
        "name": "Dylan Frazier",
        "age": 24,
        "rating": 6.478
      },
      {
        "rank": 20,
        "name": "Hunter Johnson",
        "age": 31,
        "rating": 6.442
      },
      {
        "rank": 21,
        "name": "Jaume Martinez Vich",
        "age": 32,
        "rating": 6.432
      },
      {
        "rank": 22,
        "name": "Tyson Mcguffin",
        "age": 37,
        "rating": 6.42
      },
      {
        "rank": 23,
        "name": "Pablo Tellez",
        "age": 30,
        "rating": 6.397
      },
      {
        "rank": 24,
        "name": "Robert Slutsky",
        "age": 25,
        "rating": 6.361
      },
      {
        "rank": 25,
        "name": "Yuta Funemizu",
        "age": 32,
        "rating": 6.351
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.938
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": 26,
        "rating": 6.55
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": 25,
        "rating": 6.298
      },
      {
        "rank": 4,
        "name": "Sofia Sewing",
        "age": 26,
        "rating": 6.278
      },
      {
        "rank": 5,
        "name": "Jorja Johnson",
        "age": 19,
        "rating": 6.274
      },
      {
        "rank": 6,
        "name": "Parris Todd",
        "age": 28,
        "rating": 6.262
      },
      {
        "rank": 7,
        "name": "Jackie Kawamoto",
        "age": 30,
        "rating": 6.25
      },
      {
        "rank": 8,
        "name": "Jade Kawamoto",
        "age": 30,
        "rating": 6.25
      },
      {
        "rank": 9,
        "name": "Tina Pisnik",
        "age": 45,
        "rating": 6.241
      },
      {
        "rank": 10,
        "name": "Rachel Rohrabacher",
        "age": 28,
        "rating": 6.236
      },
      {
        "rank": 11,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 6.151
      },
      {
        "rank": 12,
        "name": "Mariana Humberg",
        "age": 29,
        "rating": 6.087
      },
      {
        "rank": 13,
        "name": "Megan Fudge",
        "age": 38,
        "rating": 6.064
      },
      {
        "rank": 14,
        "name": "Vivian Glozman",
        "age": 26,
        "rating": 6.056
      },
      {
        "rank": 15,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 6.042
      },
      {
        "rank": 16,
        "name": "Kate Fahey",
        "age": 29,
        "rating": 6.038
      },
      {
        "rank": 17,
        "name": "Mariechristine Salvas",
        "age": 38,
        "rating": 6.009
      },
      {
        "rank": 18,
        "name": "Danni-Elle Townsend",
        "age": 22,
        "rating": 5.997
      },
      {
        "rank": 19,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": 50,
        "rating": 5.995
      },
      {
        "rank": 20,
        "name": "Katerina Stewart",
        "age": 28,
        "rating": 5.989
      },
      {
        "rank": 21,
        "name": "Etta Tuionetoa",
        "age": 34,
        "rating": 5.965
      },
      {
        "rank": 22,
        "name": "Allison Harris",
        "age": 33,
        "rating": 5.947
      },
      {
        "rank": 23,
        "name": "Meghan Dizon",
        "age": 33,
        "rating": 5.943
      },
      {
        "rank": 24,
        "name": "Lacy Schneemann",
        "age": 29,
        "rating": 5.936
      },
      {
        "rank": 25,
        "name": "Bobbi Oshiro",
        "age": 32,
        "rating": 5.93
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Haworth",
        "age": 33,
        "rating": 6.803
      },
      {
        "rank": 2,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.769
      },
      {
        "rank": 3,
        "name": "Hunter Johnson",
        "age": 31,
        "rating": 6.699
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": 25,
        "rating": 6.581
      },
      {
        "rank": 5,
        "name": "Ben Johns",
        "age": 27,
        "rating": 6.568
      },
      {
        "rank": 6,
        "name": "Zane Ford",
        "age": 21,
        "rating": 6.541
      },
      {
        "rank": 7,
        "name": "Jack Sock",
        "age": 33,
        "rating": 6.533
      },
      {
        "rank": 8,
        "name": "John Goins",
        "age": 18,
        "rating": 6.518
      },
      {
        "rank": 9,
        "name": "Roscoe Bellamy",
        "age": 26,
        "rating": 6.486
      },
      {
        "rank": 10,
        "name": "Ammar Wazir",
        "age": 23,
        "rating": 6.485
      },
      {
        "rank": 11,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.448
      },
      {
        "rank": 12,
        "name": "Jaume Martinez Vich",
        "age": 32,
        "rating": 6.424
      },
      {
        "rank": 13,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.395
      },
      {
        "rank": 14,
        "name": "JW Johnson",
        "age": 24,
        "rating": 6.31
      },
      {
        "rank": 15,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.295
      },
      {
        "rank": 16,
        "name": "Mohaned Alhouni",
        "age": 30,
        "rating": 6.292
      },
      {
        "rank": 17,
        "name": "Matthew Barlow",
        "age": 31,
        "rating": 6.285
      },
      {
        "rank": 18,
        "name": "Adam Harvey",
        "age": 24,
        "rating": 6.277
      },
      {
        "rank": 19,
        "name": "Dylan Frazier",
        "age": 24,
        "rating": 6.269
      },
      {
        "rank": 20,
        "name": "Nam Ly Hoang",
        "age": 29,
        "rating": 6.267
      },
      {
        "rank": 21,
        "name": "Gabriel Joseph",
        "age": 29,
        "rating": 6.257
      },
      {
        "rank": 22,
        "name": "Gabriel Tardio",
        "age": 20,
        "rating": 6.255
      },
      {
        "rank": 23,
        "name": "Luca Mack",
        "age": 25,
        "rating": 6.244
      },
      {
        "rank": 24,
        "name": "Rafa Hewett",
        "age": 31,
        "rating": 6.238
      },
      {
        "rank": 25,
        "name": "Donald Young",
        "age": 36,
        "rating": 6.237
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.453
      },
      {
        "rank": 2,
        "name": "Kate Fahey",
        "age": 29,
        "rating": 6.175
      },
      {
        "rank": 3,
        "name": "Parris Todd",
        "age": 28,
        "rating": 6.105
      },
      {
        "rank": 4,
        "name": "Katerina Stewart",
        "age": 28,
        "rating": 6.082
      },
      {
        "rank": 5,
        "name": "Sofia Sewing",
        "age": 26,
        "rating": 6.001
      },
      {
        "rank": 6,
        "name": "Lea Jansen",
        "age": 33,
        "rating": 5.882
      },
      {
        "rank": 7,
        "name": "Seone Mendez",
        "age": 27,
        "rating": 5.875
      },
      {
        "rank": 8,
        "name": "Brooke Buckner",
        "age": 34,
        "rating": 5.874
      },
      {
        "rank": 9,
        "name": "Kaitlyn Christian",
        "age": 34,
        "rating": 5.864
      },
      {
        "rank": 10,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.815
      },
      {
        "rank": 11,
        "name": "Genie Bouchard",
        "age": 32,
        "rating": 5.769
      },
      {
        "rank": 12,
        "name": "Judit Castillo Gargallo",
        "age": 27,
        "rating": 5.764
      },
      {
        "rank": 13,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 5.759
      },
      {
        "rank": 14,
        "name": "Sahra Dennehy",
        "age": 23,
        "rating": 5.738
      },
      {
        "rank": 15,
        "name": "Mary Brascia",
        "age": 26,
        "rating": 5.684
      },
      {
        "rank": 16,
        "name": "Andie Dikosavljevic",
        "age": 30,
        "rating": 5.676
      },
      {
        "rank": 17,
        "name": "Chao Yi Wang",
        "age": 24,
        "rating": 5.669
      },
      {
        "rank": 18,
        "name": "Domenika Turkovic",
        "age": 25,
        "rating": 5.663
      },
      {
        "rank": 19,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 5.661
      },
      {
        "rank": 20,
        "name": "Salome Devidze",
        "age": 40,
        "rating": 5.648
      },
      {
        "rank": 21,
        "name": "Samantha Parker",
        "age": 27,
        "rating": 5.639
      },
      {
        "rank": 22,
        "name": "Isabella Dunlap",
        "age": 26,
        "rating": 5.636
      },
      {
        "rank": 23,
        "name": "Jorja Johnson",
        "age": 19,
        "rating": 5.62
      },
      {
        "rank": 24,
        "name": "Kao Pei Chuan",
        "age": 31,
        "rating": 5.615
      },
      {
        "rank": 25,
        "name": "Yu-Chieh Hsieh",
        "age": 32,
        "rating": 5.57
      }
    ]
  },
  "junior": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.203
      },
      {
        "rank": 2,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.094
      },
      {
        "rank": 3,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.02
      },
      {
        "rank": 4,
        "name": "Will Mackinnon",
        "age": 17,
        "rating": 5.995
      },
      {
        "rank": 5,
        "name": "Tristan Dussault",
        "age": 17,
        "rating": 5.945
      },
      {
        "rank": 6,
        "name": "Jace Morris",
        "age": 17,
        "rating": 5.837
      },
      {
        "rank": 7,
        "name": "Mateusz Matysik",
        "age": 18,
        "rating": 5.766
      },
      {
        "rank": 8,
        "name": "Will Coffey",
        "age": 18,
        "rating": 5.752
      },
      {
        "rank": 9,
        "name": "Arwid Dahlin",
        "age": 17,
        "rating": 5.695
      },
      {
        "rank": 10,
        "name": "Mauro Garcia Sanchez",
        "age": 18,
        "rating": 5.689
      },
      {
        "rank": 11,
        "name": "Karthik Ganesh",
        "age": 18,
        "rating": 5.657
      },
      {
        "rank": 12,
        "name": "Parth Mody",
        "age": 17,
        "rating": 5.648
      },
      {
        "rank": 13,
        "name": "Andre Mercado",
        "age": 16,
        "rating": 5.633
      },
      {
        "rank": 14,
        "name": "George Rangelov",
        "age": 18,
        "rating": 5.623
      },
      {
        "rank": 15,
        "name": "Jace Howard",
        "age": 17,
        "rating": 5.597
      },
      {
        "rank": 16,
        "name": "Dale Kim",
        "age": 18,
        "rating": 5.581
      },
      {
        "rank": 17,
        "name": "Braden Jacobson",
        "age": 16,
        "rating": 5.566
      },
      {
        "rank": 18,
        "name": "Aj Marrero",
        "age": 17,
        "rating": 5.556
      },
      {
        "rank": 19,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.555
      },
      {
        "rank": 20,
        "name": "Ben Slive",
        "age": 16,
        "rating": 5.532
      },
      {
        "rank": 21,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.531
      },
      {
        "rank": 22,
        "name": "Jaxon Madsen",
        "age": 18,
        "rating": 5.53
      },
      {
        "rank": 23,
        "name": "Ethan Bakalinsky",
        "age": 15,
        "rating": 5.526
      },
      {
        "rank": 24,
        "name": "Andrew Caldarella",
        "age": 16,
        "rating": 5.513
      },
      {
        "rank": 25,
        "name": "Jacob Bolkowy",
        "age": 16,
        "rating": 5.489
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.594
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.583
      },
      {
        "rank": 3,
        "name": "Alexa Schull",
        "age": 18,
        "rating": 5.522
      },
      {
        "rank": 4,
        "name": "Aline Morales",
        "age": 15,
        "rating": 5.469
      },
      {
        "rank": 5,
        "name": "Emma Nelson",
        "age": 15,
        "rating": 5.416
      },
      {
        "rank": 6,
        "name": "Ella Yeh",
        "age": 16,
        "rating": 5.408
      },
      {
        "rank": 7,
        "name": "Jalina Ingram",
        "age": 18,
        "rating": 5.382
      },
      {
        "rank": 8,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 5.332
      },
      {
        "rank": 9,
        "name": "Adalynn Lund",
        "age": 16,
        "rating": 5.325
      },
      {
        "rank": 10,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 5.304
      },
      {
        "rank": 11,
        "name": "Jaeda Minniefield",
        "age": 16,
        "rating": 5.232
      },
      {
        "rank": 12,
        "name": "Victoria Nguyen",
        "age": 17,
        "rating": 5.191
      },
      {
        "rank": 13,
        "name": "Kei Sawaki",
        "age": 15,
        "rating": 5.174
      },
      {
        "rank": 14,
        "name": "Mary McGowan",
        "age": 17,
        "rating": 5.16
      },
      {
        "rank": 15,
        "name": "Jade Rau",
        "age": 16,
        "rating": 5.158
      },
      {
        "rank": 16,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 5.154
      },
      {
        "rank": 17,
        "name": "Kayla Williams",
        "age": 15,
        "rating": 5.154
      },
      {
        "rank": 18,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 5.141
      },
      {
        "rank": 19,
        "name": "Sophia Tran Phuong Anh",
        "age": 18,
        "rating": 5.138
      },
      {
        "rank": 20,
        "name": "E Elenga",
        "age": 16,
        "rating": 5.103
      },
      {
        "rank": 21,
        "name": "Victoria A Simon",
        "age": 16,
        "rating": 5.071
      },
      {
        "rank": 22,
        "name": "Naomi Amalsadiwala",
        "age": 16,
        "rating": 5.06
      },
      {
        "rank": 23,
        "name": "Ella Cosma",
        "age": 17,
        "rating": 5.033
      },
      {
        "rank": 24,
        "name": "Agnimitra Bhavatosh Bhattacharya",
        "age": 18,
        "rating": 5.021
      },
      {
        "rank": 25,
        "name": "Adelie Osher",
        "age": 17,
        "rating": 4.998
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.518
      },
      {
        "rank": 2,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.295
      },
      {
        "rank": 3,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.217
      },
      {
        "rank": 4,
        "name": "George Rangelov",
        "age": 18,
        "rating": 5.953
      },
      {
        "rank": 5,
        "name": "Tristan Dussault",
        "age": 17,
        "rating": 5.892
      },
      {
        "rank": 6,
        "name": "Jace Morris",
        "age": 17,
        "rating": 5.783
      },
      {
        "rank": 7,
        "name": "Jaxon Madsen",
        "age": 18,
        "rating": 5.725
      },
      {
        "rank": 8,
        "name": "Parth Mody",
        "age": 17,
        "rating": 5.608
      },
      {
        "rank": 9,
        "name": "Dale Kim",
        "age": 18,
        "rating": 5.567
      },
      {
        "rank": 10,
        "name": "Indy Dagnall",
        "age": 16,
        "rating": 5.533
      },
      {
        "rank": 11,
        "name": "Andrew Caldarella",
        "age": 16,
        "rating": 5.524
      },
      {
        "rank": 12,
        "name": "Dylan Lewis",
        "age": 18,
        "rating": 5.519
      },
      {
        "rank": 13,
        "name": "Mateusz Matysik",
        "age": 18,
        "rating": 5.502
      },
      {
        "rank": 14,
        "name": "Mauro Garcia Sanchez",
        "age": 18,
        "rating": 5.5
      },
      {
        "rank": 15,
        "name": "Braden Jacobson",
        "age": 16,
        "rating": 5.494
      },
      {
        "rank": 16,
        "name": "Wil Shaffer",
        "age": 17,
        "rating": 5.433
      },
      {
        "rank": 17,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.391
      },
      {
        "rank": 18,
        "name": "Le Xuan Duc",
        "age": 18,
        "rating": 5.363
      },
      {
        "rank": 19,
        "name": "Karthik Ganesh",
        "age": 18,
        "rating": 5.36
      },
      {
        "rank": 20,
        "name": "Hector Sanchez Vidal",
        "age": 17,
        "rating": 5.345
      },
      {
        "rank": 21,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.33
      },
      {
        "rank": 22,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.328
      },
      {
        "rank": 23,
        "name": "Dylan Wilhelm",
        "age": 18,
        "rating": 5.281
      },
      {
        "rank": 24,
        "name": "Arwid Dahlin",
        "age": 17,
        "rating": 5.276
      },
      {
        "rank": 25,
        "name": "Purvansh Patel",
        "age": 16,
        "rating": 5.263
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.815
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.481
      },
      {
        "rank": 3,
        "name": "Jalina Ingram",
        "age": 18,
        "rating": 5.304
      },
      {
        "rank": 4,
        "name": "Alexa Schull",
        "age": 18,
        "rating": 5.192
      },
      {
        "rank": 5,
        "name": "Kei Sawaki",
        "age": 15,
        "rating": 5.138
      },
      {
        "rank": 6,
        "name": "Emma Nelson",
        "age": 15,
        "rating": 5.128
      },
      {
        "rank": 7,
        "name": "Jade Rau",
        "age": 16,
        "rating": 5.013
      },
      {
        "rank": 8,
        "name": "Lynn Lim",
        "age": 16,
        "rating": 4.97
      },
      {
        "rank": 9,
        "name": "Sophia Tran Phuong Anh",
        "age": 18,
        "rating": 4.954
      },
      {
        "rank": 10,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 4.941
      },
      {
        "rank": 11,
        "name": "Adelie Osher",
        "age": 17,
        "rating": 4.94
      },
      {
        "rank": 12,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 4.882
      },
      {
        "rank": 13,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 4.869
      },
      {
        "rank": 14,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 4.865
      },
      {
        "rank": 15,
        "name": "Kayla Williams",
        "age": 15,
        "rating": 4.841
      },
      {
        "rank": 16,
        "name": "Agnimitra Bhavatosh Bhattacharya",
        "age": 18,
        "rating": 4.833
      },
      {
        "rank": 17,
        "name": "Caroline Maguire",
        "age": 14,
        "rating": 4.755
      },
      {
        "rank": 18,
        "name": "E Elenga",
        "age": 16,
        "rating": 4.699
      },
      {
        "rank": 19,
        "name": "Jing Robinson",
        "age": 14,
        "rating": 4.666
      },
      {
        "rank": 20,
        "name": "Veera Selanne",
        "age": 18,
        "rating": 4.637
      },
      {
        "rank": 21,
        "name": "Aria Henare",
        "age": 16,
        "rating": 4.629
      },
      {
        "rank": 22,
        "name": "Stevie Petropouleas",
        "age": 14,
        "rating": 4.597
      },
      {
        "rank": 23,
        "name": "Aleisha Horridge",
        "age": 18,
        "rating": 4.591
      },
      {
        "rank": 24,
        "name": "Eliana Ling",
        "age": 17,
        "rating": 4.546
      },
      {
        "rank": 25,
        "name": "Diane Huynh",
        "age": 14,
        "rating": 4.522
      }
    ]
  },
  "asia": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Yuta Funemizu",
        "age": null,
        "rating": 6.351
      },
      {
        "rank": 2,
        "name": "Quang Duong",
        "age": null,
        "rating": 6.35
      },
      {
        "rank": 3,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 6.328
      },
      {
        "rank": 4,
        "name": "Jonathan Truong",
        "age": null,
        "rating": 6.319
      },
      {
        "rank": 5,
        "name": "Quan Do",
        "age": null,
        "rating": 6.159
      },
      {
        "rank": 6,
        "name": "Len Yang",
        "age": null,
        "rating": 6.157
      },
      {
        "rank": 7,
        "name": "Thomas Yu",
        "age": null,
        "rating": 6.078
      },
      {
        "rank": 8,
        "name": "Eric Roddy",
        "age": null,
        "rating": 6.042
      },
      {
        "rank": 9,
        "name": "Harsh Mehta",
        "age": null,
        "rating": 5.967
      },
      {
        "rank": 10,
        "name": "Sanil Jagtiani",
        "age": null,
        "rating": 5.939
      },
      {
        "rank": 11,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.936
      },
      {
        "rank": 12,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 5.915
      },
      {
        "rank": 13,
        "name": "Kailas Shekar",
        "age": null,
        "rating": 5.897
      },
      {
        "rank": 14,
        "name": "Truong Hien",
        "age": null,
        "rating": 5.873
      },
      {
        "rank": 15,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.855
      },
      {
        "rank": 16,
        "name": "Santhosh Narayanan",
        "age": null,
        "rating": 5.854
      },
      {
        "rank": 17,
        "name": "Eunggwon Kim",
        "age": null,
        "rating": 5.848
      },
      {
        "rank": 18,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.846
      },
      {
        "rank": 19,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.799
      },
      {
        "rank": 20,
        "name": "James Yu",
        "age": null,
        "rating": 5.796
      },
      {
        "rank": 21,
        "name": "Phuc Huynh",
        "age": null,
        "rating": 5.778
      },
      {
        "rank": 22,
        "name": "Aryaan Bhatia",
        "age": null,
        "rating": 5.767
      },
      {
        "rank": 23,
        "name": "Bassem Kheireddin",
        "age": null,
        "rating": 5.693
      },
      {
        "rank": 24,
        "name": "Yuvraj Ruia",
        "age": null,
        "rating": 5.693
      },
      {
        "rank": 25,
        "name": "Usama Khalid Sam",
        "age": null,
        "rating": 5.638
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.891
      },
      {
        "rank": 2,
        "name": "Aibika Kalsarieva",
        "age": null,
        "rating": 5.854
      },
      {
        "rank": 3,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.844
      },
      {
        "rank": 4,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.77
      },
      {
        "rank": 5,
        "name": "Alix Truong",
        "age": null,
        "rating": 5.76
      },
      {
        "rank": 6,
        "name": "Nicole Eugenio",
        "age": null,
        "rating": 5.694
      },
      {
        "rank": 7,
        "name": "Marisa Ruiz",
        "age": null,
        "rating": 5.692
      },
      {
        "rank": 8,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.57
      },
      {
        "rank": 9,
        "name": "Kara Wheatley",
        "age": null,
        "rating": 5.543
      },
      {
        "rank": 10,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.537
      },
      {
        "rank": 11,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.48
      },
      {
        "rank": 12,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.479
      },
      {
        "rank": 13,
        "name": "Xiao Yi Wang Beckvall",
        "age": null,
        "rating": 5.476
      },
      {
        "rank": 14,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.463
      },
      {
        "rank": 15,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.456
      },
      {
        "rank": 16,
        "name": "Ken Tam",
        "age": null,
        "rating": 5.441
      },
      {
        "rank": 17,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.437
      },
      {
        "rank": 18,
        "name": "Vritti Sethi",
        "age": null,
        "rating": 5.427
      },
      {
        "rank": 19,
        "name": "Sarah Jane Lim",
        "age": null,
        "rating": 5.424
      },
      {
        "rank": 20,
        "name": "Sophia Huỳnh Trần Ngọc Nhi",
        "age": null,
        "rating": 5.364
      },
      {
        "rank": 21,
        "name": "Lyn Yuen Choo",
        "age": null,
        "rating": 5.357
      },
      {
        "rank": 22,
        "name": "Kai Fen Yi",
        "age": null,
        "rating": 5.352
      },
      {
        "rank": 23,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.344
      },
      {
        "rank": 24,
        "name": "Emma Ruoyi Li",
        "age": null,
        "rating": 5.337
      },
      {
        "rank": 25,
        "name": "Naimi Mehta",
        "age": null,
        "rating": 5.274
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 2,
        "name": "Phuc Huynh",
        "age": null,
        "rating": 6.234
      },
      {
        "rank": 3,
        "name": "Luc Pham",
        "age": null,
        "rating": 6.145
      },
      {
        "rank": 4,
        "name": "Eric Roddy",
        "age": null,
        "rating": 6.077
      },
      {
        "rank": 5,
        "name": "Truong Hien",
        "age": null,
        "rating": 6.062
      },
      {
        "rank": 6,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 5.942
      },
      {
        "rank": 7,
        "name": "Cheng En Tsai",
        "age": null,
        "rating": 5.892
      },
      {
        "rank": 8,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.874
      },
      {
        "rank": 9,
        "name": "Hoàng Nguyễn Việt",
        "age": null,
        "rating": 5.873
      },
      {
        "rank": 10,
        "name": "Thomas Yu",
        "age": null,
        "rating": 5.856
      },
      {
        "rank": 11,
        "name": "Giang Trinh",
        "age": null,
        "rating": 5.752
      },
      {
        "rank": 12,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.75
      },
      {
        "rank": 13,
        "name": "Nguyen Hung Anh",
        "age": null,
        "rating": 5.715
      },
      {
        "rank": 14,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.691
      },
      {
        "rank": 15,
        "name": "Nasa Hatakeyama",
        "age": null,
        "rating": 5.679
      },
      {
        "rank": 16,
        "name": "Shay Hugo",
        "age": null,
        "rating": 5.614
      },
      {
        "rank": 17,
        "name": "Kento Tamaki",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 18,
        "name": "Jonathan Truong",
        "age": null,
        "rating": 5.579
      },
      {
        "rank": 19,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.567
      },
      {
        "rank": 20,
        "name": "Kenneth Lee",
        "age": null,
        "rating": 5.566
      },
      {
        "rank": 21,
        "name": "Rohin Rajani",
        "age": null,
        "rating": 5.557
      },
      {
        "rank": 22,
        "name": "Vũ Phạm",
        "age": null,
        "rating": 5.541
      },
      {
        "rank": 23,
        "name": "Jimmy Liong Kai Long",
        "age": null,
        "rating": 5.515
      },
      {
        "rank": 24,
        "name": "Ruben A Gonzales Jr",
        "age": null,
        "rating": 5.511
      },
      {
        "rank": 25,
        "name": "Yuta Funemizu",
        "age": null,
        "rating": 5.5
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.7
      },
      {
        "rank": 2,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.638
      },
      {
        "rank": 3,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.619
      },
      {
        "rank": 4,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.57
      },
      {
        "rank": 5,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.502
      },
      {
        "rank": 6,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.398
      },
      {
        "rank": 7,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.35
      },
      {
        "rank": 8,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.33
      },
      {
        "rank": 9,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.306
      },
      {
        "rank": 10,
        "name": "Mihika Yadav",
        "age": null,
        "rating": 5.281
      },
      {
        "rank": 11,
        "name": "Albie Huang",
        "age": null,
        "rating": 5.241
      },
      {
        "rank": 12,
        "name": "Aaliya Ebrahim",
        "age": null,
        "rating": 5.169
      },
      {
        "rank": 13,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.166
      },
      {
        "rank": 14,
        "name": "Ying Suet Lam",
        "age": null,
        "rating": 5.121
      },
      {
        "rank": 15,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.079
      },
      {
        "rank": 16,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.068
      },
      {
        "rank": 17,
        "name": "Anna Clarice Patrimonio",
        "age": null,
        "rating": 5.061
      },
      {
        "rank": 18,
        "name": "Yunqi He",
        "age": null,
        "rating": 5.02
      },
      {
        "rank": 19,
        "name": "Connie Lee",
        "age": null,
        "rating": 4.994
      },
      {
        "rank": 20,
        "name": "Christy Sañosa",
        "age": null,
        "rating": 4.978
      },
      {
        "rank": 21,
        "name": "Pei-Yu Lai",
        "age": null,
        "rating": 4.967
      },
      {
        "rank": 22,
        "name": "Sophia Huỳnh Trần Ngọc Nhi",
        "age": null,
        "rating": 4.925
      },
      {
        "rank": 23,
        "name": "Sophia Tran Phuong Anh",
        "age": null,
        "rating": 4.92
      },
      {
        "rank": 24,
        "name": "Lynn Lim",
        "age": null,
        "rating": 4.919
      },
      {
        "rank": 25,
        "name": "Kei Sawaki",
        "age": null,
        "rating": 4.917
      }
    ]
  },
  "north-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Ben Johns",
        "age": null,
        "rating": 7.126
      },
      {
        "rank": 2,
        "name": "Jw Johnson",
        "age": null,
        "rating": 7.021
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": null,
        "rating": 6.904
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.858
      },
      {
        "rank": 5,
        "name": "Riley Newman",
        "age": null,
        "rating": 6.681
      },
      {
        "rank": 6,
        "name": "Cj Klinger",
        "age": null,
        "rating": 6.651
      },
      {
        "rank": 7,
        "name": "Will Howells",
        "age": null,
        "rating": 6.621
      },
      {
        "rank": 8,
        "name": "James Ignatowich",
        "age": null,
        "rating": 6.585
      },
      {
        "rank": 9,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.575
      },
      {
        "rank": 10,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.514
      },
      {
        "rank": 11,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.478
      },
      {
        "rank": 12,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.442
      },
      {
        "rank": 13,
        "name": "Tyson Mcguffin",
        "age": null,
        "rating": 6.42
      },
      {
        "rank": 14,
        "name": "Robert Slutsky",
        "age": null,
        "rating": 6.361
      },
      {
        "rank": 15,
        "name": "Maxwell Freeman",
        "age": null,
        "rating": 6.338
      },
      {
        "rank": 16,
        "name": "Augustus Ge",
        "age": null,
        "rating": 6.321
      },
      {
        "rank": 17,
        "name": "Matt Wright",
        "age": null,
        "rating": 6.318
      },
      {
        "rank": 18,
        "name": "Michael Loyd",
        "age": null,
        "rating": 6.315
      },
      {
        "rank": 19,
        "name": "Wyatt Stone",
        "age": null,
        "rating": 6.31
      },
      {
        "rank": 20,
        "name": "Zane Navratil",
        "age": null,
        "rating": 6.31
      },
      {
        "rank": 21,
        "name": "Max Manthou",
        "age": null,
        "rating": 6.305
      },
      {
        "rank": 22,
        "name": "Tyler Loong",
        "age": null,
        "rating": 6.286
      },
      {
        "rank": 23,
        "name": "Jack Munro",
        "age": null,
        "rating": 6.285
      },
      {
        "rank": 24,
        "name": "Julian Arnold",
        "age": null,
        "rating": 6.284
      },
      {
        "rank": 25,
        "name": "Travis Rettenmaier",
        "age": null,
        "rating": 6.283
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.938
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": null,
        "rating": 6.55
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": null,
        "rating": 6.298
      },
      {
        "rank": 4,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.278
      },
      {
        "rank": 5,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 6.274
      },
      {
        "rank": 6,
        "name": "Parris Todd",
        "age": null,
        "rating": 6.262
      },
      {
        "rank": 7,
        "name": "Jade Kawamoto",
        "age": null,
        "rating": 6.25
      },
      {
        "rank": 8,
        "name": "Jackie Kawamoto",
        "age": null,
        "rating": 6.25
      },
      {
        "rank": 9,
        "name": "Rachel Rohrabacher",
        "age": null,
        "rating": 6.236
      },
      {
        "rank": 10,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 6.151
      },
      {
        "rank": 11,
        "name": "Mariechristine Salvas",
        "age": null,
        "rating": 6.076
      },
      {
        "rank": 12,
        "name": "Vivian Glozman",
        "age": null,
        "rating": 6.056
      },
      {
        "rank": 13,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.038
      },
      {
        "rank": 14,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 5.989
      },
      {
        "rank": 15,
        "name": "Etta Tuionetoa",
        "age": null,
        "rating": 5.965
      },
      {
        "rank": 16,
        "name": "Allison Harris",
        "age": null,
        "rating": 5.947
      },
      {
        "rank": 17,
        "name": "Meghan Dizon",
        "age": null,
        "rating": 5.943
      },
      {
        "rank": 18,
        "name": "Lacy Schneemann",
        "age": null,
        "rating": 5.936
      },
      {
        "rank": 19,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.93
      },
      {
        "rank": 20,
        "name": "Jillian Braverman",
        "age": null,
        "rating": 5.917
      },
      {
        "rank": 21,
        "name": "Angela Simon",
        "age": null,
        "rating": 5.894
      },
      {
        "rank": 22,
        "name": "Kelsey Matthews",
        "age": null,
        "rating": 5.868
      },
      {
        "rank": 23,
        "name": "Christine Maddox",
        "age": null,
        "rating": 5.868
      },
      {
        "rank": 24,
        "name": "Jessie Irvine",
        "age": null,
        "rating": 5.863
      },
      {
        "rank": 25,
        "name": "Allyce Jones",
        "age": null,
        "rating": 5.857
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Haworth",
        "age": null,
        "rating": 6.803
      },
      {
        "rank": 2,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.699
      },
      {
        "rank": 3,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.581
      },
      {
        "rank": 4,
        "name": "Ben Johns",
        "age": null,
        "rating": 6.568
      },
      {
        "rank": 5,
        "name": "Zane Ford",
        "age": null,
        "rating": 6.541
      },
      {
        "rank": 6,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.533
      },
      {
        "rank": 7,
        "name": "John Goins",
        "age": null,
        "rating": 6.518
      },
      {
        "rank": 8,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.486
      },
      {
        "rank": 9,
        "name": "Ammar Wazir",
        "age": null,
        "rating": 6.485
      },
      {
        "rank": 10,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.448
      },
      {
        "rank": 11,
        "name": "Tama Shimabukuro",
        "age": null,
        "rating": 6.319
      },
      {
        "rank": 12,
        "name": "Jw Johnson",
        "age": null,
        "rating": 6.31
      },
      {
        "rank": 13,
        "name": "Matthew Barlow",
        "age": null,
        "rating": 6.285
      },
      {
        "rank": 14,
        "name": "Adam Harvey",
        "age": null,
        "rating": 6.277
      },
      {
        "rank": 15,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.269
      },
      {
        "rank": 16,
        "name": "Gabriel Joseph",
        "age": null,
        "rating": 6.257
      },
      {
        "rank": 17,
        "name": "Rafa Hewett",
        "age": null,
        "rating": 6.238
      },
      {
        "rank": 18,
        "name": "Donald Young",
        "age": null,
        "rating": 6.237
      },
      {
        "rank": 19,
        "name": "Grayson Goldin",
        "age": null,
        "rating": 6.231
      },
      {
        "rank": 20,
        "name": "Yates Johnson",
        "age": null,
        "rating": 6.218
      },
      {
        "rank": 21,
        "name": "Camden Chaffin",
        "age": null,
        "rating": 6.217
      },
      {
        "rank": 22,
        "name": "Dusty Boyer",
        "age": null,
        "rating": 6.207
      },
      {
        "rank": 23,
        "name": "Alexander Crum",
        "age": null,
        "rating": 6.182
      },
      {
        "rank": 24,
        "name": "Brandon French",
        "age": null,
        "rating": 6.15
      },
      {
        "rank": 25,
        "name": "Ronan Camron",
        "age": null,
        "rating": 6.142
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.453
      },
      {
        "rank": 2,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.175
      },
      {
        "rank": 3,
        "name": "Parris Todd",
        "age": null,
        "rating": 6.105
      },
      {
        "rank": 4,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 6.082
      },
      {
        "rank": 5,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.001
      },
      {
        "rank": 6,
        "name": "Lea Jansen",
        "age": null,
        "rating": 5.882
      },
      {
        "rank": 7,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.874
      },
      {
        "rank": 8,
        "name": "Kaitlyn Christian",
        "age": null,
        "rating": 5.864
      },
      {
        "rank": 9,
        "name": "Kiora Kunimoto",
        "age": null,
        "rating": 5.815
      },
      {
        "rank": 10,
        "name": "Genie Bouchard",
        "age": null,
        "rating": 5.769
      },
      {
        "rank": 11,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 5.759
      },
      {
        "rank": 12,
        "name": "Mary Brascia",
        "age": null,
        "rating": 5.684
      },
      {
        "rank": 13,
        "name": "Samantha Parker",
        "age": null,
        "rating": 5.639
      },
      {
        "rank": 14,
        "name": "Isabella Dunlap",
        "age": null,
        "rating": 5.636
      },
      {
        "rank": 15,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 5.62
      },
      {
        "rank": 16,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.566
      },
      {
        "rank": 17,
        "name": "Simone Jardim",
        "age": null,
        "rating": 5.55
      },
      {
        "rank": 18,
        "name": "Victoria Dimuzio",
        "age": null,
        "rating": 5.548
      },
      {
        "rank": 19,
        "name": "Cailyn Campbell",
        "age": null,
        "rating": 5.481
      },
      {
        "rank": 20,
        "name": "Amber Policare",
        "age": null,
        "rating": 5.457
      },
      {
        "rank": 21,
        "name": "Liz Truluck",
        "age": null,
        "rating": 5.453
      },
      {
        "rank": 22,
        "name": "Milan Rane",
        "age": null,
        "rating": 5.435
      },
      {
        "rank": 23,
        "name": "Jessica Warren",
        "age": null,
        "rating": 5.433
      },
      {
        "rank": 24,
        "name": "Zoey Weil",
        "age": null,
        "rating": 5.405
      },
      {
        "rank": 25,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.381
      }
    ]
  },
  "south-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Gabriel Tardio",
        "age": null,
        "rating": 6.862
      },
      {
        "rank": 2,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.711
      },
      {
        "rank": 3,
        "name": "Nicolas Acevedo",
        "age": null,
        "rating": 6.619
      },
      {
        "rank": 4,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.617
      },
      {
        "rank": 5,
        "name": "Pablo Tellez",
        "age": null,
        "rating": 6.397
      },
      {
        "rank": 6,
        "name": "Jaime Oncins",
        "age": null,
        "rating": 6.07
      },
      {
        "rank": 7,
        "name": "Juan Benitez",
        "age": null,
        "rating": 6.056
      },
      {
        "rank": 8,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.034
      },
      {
        "rank": 9,
        "name": "Bruno Faletto",
        "age": null,
        "rating": 6.018
      },
      {
        "rank": 10,
        "name": "Mario Barrientos",
        "age": null,
        "rating": 5.887
      },
      {
        "rank": 11,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.857
      },
      {
        "rank": 12,
        "name": "Carlos Di Laura",
        "age": null,
        "rating": 5.781
      },
      {
        "rank": 13,
        "name": "Patricio Pereyra",
        "age": null,
        "rating": 5.749
      },
      {
        "rank": 14,
        "name": "Caio Bardauil",
        "age": null,
        "rating": 5.692
      },
      {
        "rank": 15,
        "name": "Miguel Alda",
        "age": null,
        "rating": 5.601
      },
      {
        "rank": 16,
        "name": "Armando Ferreira",
        "age": null,
        "rating": 5.589
      },
      {
        "rank": 17,
        "name": "Federico Nani",
        "age": null,
        "rating": 5.487
      },
      {
        "rank": 18,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.47
      },
      {
        "rank": 19,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.456
      },
      {
        "rank": 20,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.456
      },
      {
        "rank": 21,
        "name": "Juan Medina",
        "age": null,
        "rating": 5.407
      },
      {
        "rank": 22,
        "name": "Alex Simon",
        "age": null,
        "rating": 5.375
      },
      {
        "rank": 23,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 5.372
      },
      {
        "rank": 24,
        "name": "Nicolas Almeida",
        "age": null,
        "rating": 5.305
      },
      {
        "rank": 25,
        "name": "Ignacio De Elia",
        "age": null,
        "rating": 5.305
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 6.087
      },
      {
        "rank": 2,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 5.995
      },
      {
        "rank": 3,
        "name": "Pierina Imparato",
        "age": null,
        "rating": 5.537
      },
      {
        "rank": 4,
        "name": "Lucia White",
        "age": null,
        "rating": 5.512
      },
      {
        "rank": 5,
        "name": "Florencia Rossi Luque",
        "age": null,
        "rating": 5.24
      },
      {
        "rank": 6,
        "name": "Alexa Quintanilla",
        "age": null,
        "rating": 5.22
      },
      {
        "rank": 7,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 5.201
      },
      {
        "rank": 8,
        "name": "Gabriela Katz",
        "age": null,
        "rating": 5.191
      },
      {
        "rank": 9,
        "name": "Nicole Lange Beidacki",
        "age": null,
        "rating": 5.175
      },
      {
        "rank": 10,
        "name": "Bequi Barros Behar Luizelli",
        "age": null,
        "rating": 5.1
      },
      {
        "rank": 11,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.036
      },
      {
        "rank": 12,
        "name": "Tatiana Ruhl",
        "age": null,
        "rating": 4.964
      },
      {
        "rank": 13,
        "name": "Ali Quintero",
        "age": null,
        "rating": 4.906
      },
      {
        "rank": 14,
        "name": "Arianna Raga",
        "age": null,
        "rating": 4.894
      },
      {
        "rank": 15,
        "name": "Patricia Medrado",
        "age": null,
        "rating": 4.856
      },
      {
        "rank": 16,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.851
      },
      {
        "rank": 17,
        "name": "Valentina Martin",
        "age": null,
        "rating": 4.833
      },
      {
        "rank": 18,
        "name": "Mariana Jimenez",
        "age": null,
        "rating": 4.83
      },
      {
        "rank": 19,
        "name": "Mariana Paredes",
        "age": null,
        "rating": 4.807
      },
      {
        "rank": 20,
        "name": "Dayana Fahey",
        "age": null,
        "rating": 4.768
      },
      {
        "rank": 21,
        "name": "Deborah Gebara",
        "age": null,
        "rating": 4.755
      },
      {
        "rank": 22,
        "name": "Camila Militao",
        "age": null,
        "rating": 4.753
      },
      {
        "rank": 23,
        "name": "Karina Salles",
        "age": null,
        "rating": 4.752
      },
      {
        "rank": 24,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.749
      },
      {
        "rank": 25,
        "name": "Katie Neils",
        "age": null,
        "rating": 4.709
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.769
      },
      {
        "rank": 2,
        "name": "Gabriel Tardio",
        "age": null,
        "rating": 6.255
      },
      {
        "rank": 3,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.208
      },
      {
        "rank": 4,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.204
      },
      {
        "rank": 5,
        "name": "Pablo Tellez",
        "age": null,
        "rating": 5.883
      },
      {
        "rank": 6,
        "name": "Juan Benitez",
        "age": null,
        "rating": 5.857
      },
      {
        "rank": 7,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.517
      },
      {
        "rank": 8,
        "name": "Armando Ferreira",
        "age": null,
        "rating": 5.336
      },
      {
        "rank": 9,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.287
      },
      {
        "rank": 10,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.283
      },
      {
        "rank": 11,
        "name": "Nicolas Almeida",
        "age": null,
        "rating": 5.277
      },
      {
        "rank": 12,
        "name": "Lucas Severo",
        "age": null,
        "rating": 5.163
      },
      {
        "rank": 13,
        "name": "Bernardo Valdes",
        "age": null,
        "rating": 5.068
      },
      {
        "rank": 14,
        "name": "Bruno Semino",
        "age": null,
        "rating": 5.01
      },
      {
        "rank": 15,
        "name": "Rodrigo  Borrero",
        "age": null,
        "rating": 4.99
      },
      {
        "rank": 16,
        "name": "Cristobal Del Castillo",
        "age": null,
        "rating": 4.97
      },
      {
        "rank": 17,
        "name": "João Pedro  Agulha Fernandes",
        "age": null,
        "rating": 4.942
      },
      {
        "rank": 18,
        "name": "Juan Pablo Pinilla",
        "age": null,
        "rating": 4.931
      },
      {
        "rank": 19,
        "name": "Eduardo Correia",
        "age": null,
        "rating": 4.921
      },
      {
        "rank": 20,
        "name": "Thiago Soto",
        "age": null,
        "rating": 4.901
      },
      {
        "rank": 21,
        "name": "Fernando  Zurita",
        "age": null,
        "rating": 4.86
      },
      {
        "rank": 22,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 4.819
      },
      {
        "rank": 23,
        "name": "Adrian Morales",
        "age": null,
        "rating": 4.782
      },
      {
        "rank": 24,
        "name": "Caian  Matos",
        "age": null,
        "rating": 4.763
      },
      {
        "rank": 25,
        "name": "José Emmanuel  Alvarez Ferreyra",
        "age": null,
        "rating": 4.649
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 5.273
      },
      {
        "rank": 2,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 5.105
      },
      {
        "rank": 3,
        "name": "Sofia Kelbert",
        "age": null,
        "rating": 4.629
      },
      {
        "rank": 4,
        "name": "Ana Sánchez",
        "age": null,
        "rating": 4.274
      },
      {
        "rank": 5,
        "name": "Javiera Elena Escobar",
        "age": null,
        "rating": 4.219
      },
      {
        "rank": 6,
        "name": "Mariana Negreiros Mariano",
        "age": null,
        "rating": 4.207
      },
      {
        "rank": 7,
        "name": "Carolina Ledesma",
        "age": null,
        "rating": 4.089
      },
      {
        "rank": 8,
        "name": "Michelle Hasson",
        "age": null,
        "rating": 3.956
      },
      {
        "rank": 9,
        "name": "Gabriela Velazquez",
        "age": null,
        "rating": 3.548
      },
      {
        "rank": 10,
        "name": "Rosana Ahlers",
        "age": null,
        "rating": 3.437
      },
      {
        "rank": 11,
        "name": "Karina Elmoznino",
        "age": null,
        "rating": 3.43
      },
      {
        "rank": 12,
        "name": "Yesica Grecco",
        "age": null,
        "rating": 3.413
      }
    ]
  },
  "australia-oceania": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "George Wall",
        "age": null,
        "rating": 6.127
      },
      {
        "rank": 2,
        "name": "Andre Mick",
        "age": null,
        "rating": 6.012
      },
      {
        "rank": 3,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.996
      },
      {
        "rank": 4,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.949
      },
      {
        "rank": 5,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.791
      },
      {
        "rank": 6,
        "name": "Robert Claveria Stirling",
        "age": null,
        "rating": 5.764
      },
      {
        "rank": 7,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.754
      },
      {
        "rank": 8,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.679
      },
      {
        "rank": 9,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.638
      },
      {
        "rank": 10,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.624
      },
      {
        "rank": 11,
        "name": "Morgan Evans",
        "age": null,
        "rating": 5.576
      },
      {
        "rank": 12,
        "name": "Brian  Tran",
        "age": null,
        "rating": 5.559
      },
      {
        "rank": 13,
        "name": "Ciaran Lavers",
        "age": null,
        "rating": 5.45
      },
      {
        "rank": 14,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.413
      },
      {
        "rank": 15,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 5.394
      },
      {
        "rank": 16,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.389
      },
      {
        "rank": 17,
        "name": "Jai Grewal",
        "age": null,
        "rating": 5.366
      },
      {
        "rank": 18,
        "name": "Shaun Tamai",
        "age": null,
        "rating": 5.312
      },
      {
        "rank": 19,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.309
      },
      {
        "rank": 20,
        "name": "Will Dewhirst",
        "age": null,
        "rating": 5.309
      },
      {
        "rank": 21,
        "name": "Tony Field",
        "age": null,
        "rating": 5.298
      },
      {
        "rank": 22,
        "name": "Shane Wilson",
        "age": null,
        "rating": 5.297
      },
      {
        "rank": 23,
        "name": "Tristan Stayt",
        "age": null,
        "rating": 5.295
      },
      {
        "rank": 24,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.287
      },
      {
        "rank": 25,
        "name": "Andrew Kratzmann",
        "age": null,
        "rating": 5.284
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 5.997
      },
      {
        "rank": 2,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.831
      },
      {
        "rank": 3,
        "name": "Somer Dallabona",
        "age": null,
        "rating": 5.752
      },
      {
        "rank": 4,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.735
      },
      {
        "rank": 5,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.712
      },
      {
        "rank": 6,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.708
      },
      {
        "rank": 7,
        "name": "Ashlee Candelaria",
        "age": null,
        "rating": 5.705
      },
      {
        "rank": 8,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.668
      },
      {
        "rank": 9,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.58
      },
      {
        "rank": 10,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 5.415
      },
      {
        "rank": 11,
        "name": "Sarah Burr",
        "age": null,
        "rating": 5.391
      },
      {
        "rank": 12,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 5.319
      },
      {
        "rank": 13,
        "name": "Talia Saunders",
        "age": null,
        "rating": 5.297
      },
      {
        "rank": 14,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.278
      },
      {
        "rank": 15,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.27
      },
      {
        "rank": 16,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 5.216
      },
      {
        "rank": 17,
        "name": "Brittany Yang",
        "age": null,
        "rating": 5.159
      },
      {
        "rank": 18,
        "name": "Lara Giltinan",
        "age": null,
        "rating": 5.109
      },
      {
        "rank": 19,
        "name": "Tyra Calderwood",
        "age": null,
        "rating": 5.085
      },
      {
        "rank": 20,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.08
      },
      {
        "rank": 21,
        "name": "Belinda Crane",
        "age": null,
        "rating": 5.077
      },
      {
        "rank": 22,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 5.07
      },
      {
        "rank": 23,
        "name": "Tayah Cross",
        "age": null,
        "rating": 5.047
      },
      {
        "rank": 24,
        "name": "Karen Denman",
        "age": null,
        "rating": 5.047
      },
      {
        "rank": 25,
        "name": "Katerina Valos",
        "age": null,
        "rating": 4.998
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Robbie  Lee",
        "age": null,
        "rating": 5.95
      },
      {
        "rank": 2,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.717
      },
      {
        "rank": 3,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.625
      },
      {
        "rank": 4,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.614
      },
      {
        "rank": 5,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.454
      },
      {
        "rank": 6,
        "name": "Brian  Tran",
        "age": null,
        "rating": 5.444
      },
      {
        "rank": 7,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.399
      },
      {
        "rank": 8,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.358
      },
      {
        "rank": 9,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.2
      },
      {
        "rank": 10,
        "name": "Joshua Nipperess",
        "age": null,
        "rating": 5.199
      },
      {
        "rank": 11,
        "name": "Andy Van Der Vyver",
        "age": null,
        "rating": 5.189
      },
      {
        "rank": 12,
        "name": "Ashton Chan",
        "age": null,
        "rating": 5.181
      },
      {
        "rank": 13,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.144
      },
      {
        "rank": 14,
        "name": "Henrik Traskin",
        "age": null,
        "rating": 5.139
      },
      {
        "rank": 15,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.136
      },
      {
        "rank": 16,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.135
      },
      {
        "rank": 17,
        "name": "Matthew Kouznetsov",
        "age": null,
        "rating": 5.105
      },
      {
        "rank": 18,
        "name": "Nigel Lee",
        "age": null,
        "rating": 5.083
      },
      {
        "rank": 19,
        "name": "Ethan Chung",
        "age": null,
        "rating": 5.08
      },
      {
        "rank": 20,
        "name": "Kyron Pinter",
        "age": null,
        "rating": 5.064
      },
      {
        "rank": 21,
        "name": "Joshua Barber",
        "age": null,
        "rating": 5.031
      },
      {
        "rank": 22,
        "name": "Liam Lamb",
        "age": null,
        "rating": 4.991
      },
      {
        "rank": 23,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 4.986
      },
      {
        "rank": 24,
        "name": "Chanchai  Sookton-Eng",
        "age": null,
        "rating": 4.945
      },
      {
        "rank": 25,
        "name": "Ethan Butson",
        "age": null,
        "rating": 4.943
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.875
      },
      {
        "rank": 2,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.738
      },
      {
        "rank": 3,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.676
      },
      {
        "rank": 4,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.561
      },
      {
        "rank": 5,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.483
      },
      {
        "rank": 6,
        "name": "Lara Giltinan",
        "age": null,
        "rating": 5.426
      },
      {
        "rank": 7,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.405
      },
      {
        "rank": 8,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 5.16
      },
      {
        "rank": 9,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.128
      },
      {
        "rank": 10,
        "name": "Jasmine Almaguer",
        "age": null,
        "rating": 5.115
      },
      {
        "rank": 11,
        "name": "Helena Spiridis",
        "age": null,
        "rating": 5.1
      },
      {
        "rank": 12,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 5.098
      },
      {
        "rank": 13,
        "name": "Ange Green",
        "age": null,
        "rating": 5.013
      },
      {
        "rank": 14,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 4.977
      },
      {
        "rank": 15,
        "name": "Simone Kessell",
        "age": null,
        "rating": 4.948
      },
      {
        "rank": 16,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 4.893
      },
      {
        "rank": 17,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 4.886
      },
      {
        "rank": 18,
        "name": "Bee Horsley",
        "age": null,
        "rating": 4.872
      },
      {
        "rank": 19,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 4.867
      },
      {
        "rank": 20,
        "name": "Brittany Yang",
        "age": null,
        "rating": 4.862
      },
      {
        "rank": 21,
        "name": "Rosa Morris",
        "age": null,
        "rating": 4.844
      },
      {
        "rank": 22,
        "name": "Mandy Corbett",
        "age": null,
        "rating": 4.793
      },
      {
        "rank": 23,
        "name": "Miki Masui",
        "age": null,
        "rating": 4.786
      },
      {
        "rank": 24,
        "name": "Karen Denman",
        "age": null,
        "rating": 4.774
      },
      {
        "rank": 25,
        "name": "Tayah Cross",
        "age": null,
        "rating": 4.709
      }
    ]
  },
  "europe": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Andrei Daescu",
        "age": null,
        "rating": 6.951
      },
      {
        "rank": 2,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 6.637
      },
      {
        "rank": 3,
        "name": "Dekel Bar",
        "age": null,
        "rating": 6.574
      },
      {
        "rank": 4,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.549
      },
      {
        "rank": 5,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.432
      },
      {
        "rank": 6,
        "name": "Martin Emmrich",
        "age": null,
        "rating": 6.297
      },
      {
        "rank": 7,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 6.239
      },
      {
        "rank": 8,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.227
      },
      {
        "rank": 9,
        "name": "Dj Young",
        "age": null,
        "rating": 6.141
      },
      {
        "rank": 10,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 6.103
      },
      {
        "rank": 11,
        "name": "Oscar Serra",
        "age": null,
        "rating": 6.065
      },
      {
        "rank": 12,
        "name": "Tom Protzek",
        "age": null,
        "rating": 5.982
      },
      {
        "rank": 13,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.863
      },
      {
        "rank": 14,
        "name": "Domenico Geminiani",
        "age": null,
        "rating": 5.859
      },
      {
        "rank": 15,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 5.846
      },
      {
        "rank": 16,
        "name": "Patrick Smith",
        "age": null,
        "rating": 5.837
      },
      {
        "rank": 17,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.819
      },
      {
        "rank": 18,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.806
      },
      {
        "rank": 19,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.761
      },
      {
        "rank": 20,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.752
      },
      {
        "rank": 21,
        "name": "Rosen Naydenov",
        "age": null,
        "rating": 5.747
      },
      {
        "rank": 22,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.734
      },
      {
        "rank": 23,
        "name": "Mark Growcott",
        "age": null,
        "rating": 5.73
      },
      {
        "rank": 24,
        "name": "Maksims Kazijevs",
        "age": null,
        "rating": 5.7
      },
      {
        "rank": 25,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.699
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Tina Pisnik",
        "age": null,
        "rating": 6.241
      },
      {
        "rank": 2,
        "name": "Megan Fudge",
        "age": null,
        "rating": 6.064
      },
      {
        "rank": 3,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 6.042
      },
      {
        "rank": 4,
        "name": "Ewa Radzikowska",
        "age": null,
        "rating": 5.855
      },
      {
        "rank": 5,
        "name": "Daria Walczak",
        "age": null,
        "rating": 5.808
      },
      {
        "rank": 6,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.746
      },
      {
        "rank": 7,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.743
      },
      {
        "rank": 8,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.722
      },
      {
        "rank": 9,
        "name": "Maria Klokotzky",
        "age": null,
        "rating": 5.703
      },
      {
        "rank": 10,
        "name": "Lucy Kovalova",
        "age": null,
        "rating": 5.65
      },
      {
        "rank": 11,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.607
      },
      {
        "rank": 12,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.584
      },
      {
        "rank": 13,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.58
      },
      {
        "rank": 14,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.56
      },
      {
        "rank": 15,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.538
      },
      {
        "rank": 16,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.521
      },
      {
        "rank": 17,
        "name": "Andrea Olson",
        "age": null,
        "rating": 5.517
      },
      {
        "rank": 18,
        "name": "Martina Frantova",
        "age": null,
        "rating": 5.486
      },
      {
        "rank": 19,
        "name": "Glauka Carvajal Lane",
        "age": null,
        "rating": 5.438
      },
      {
        "rank": 20,
        "name": "Tea Pejic",
        "age": null,
        "rating": 5.413
      },
      {
        "rank": 21,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.398
      },
      {
        "rank": 22,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 5.396
      },
      {
        "rank": 23,
        "name": "Paula Rives Palau",
        "age": null,
        "rating": 5.393
      },
      {
        "rank": 24,
        "name": "Giorgia Vitale",
        "age": null,
        "rating": 5.355
      },
      {
        "rank": 25,
        "name": "Lorena Duknic",
        "age": null,
        "rating": 5.323
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.424
      },
      {
        "rank": 2,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.395
      },
      {
        "rank": 3,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.244
      },
      {
        "rank": 4,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 6.159
      },
      {
        "rank": 5,
        "name": "Oliver Frank",
        "age": null,
        "rating": 6.141
      },
      {
        "rank": 6,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 6.102
      },
      {
        "rank": 7,
        "name": "Tom Protzek",
        "age": null,
        "rating": 6.102
      },
      {
        "rank": 8,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 5.99
      },
      {
        "rank": 9,
        "name": "George Rangelov",
        "age": null,
        "rating": 5.953
      },
      {
        "rank": 10,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 5.881
      },
      {
        "rank": 11,
        "name": "Matthew Finnerty",
        "age": null,
        "rating": 5.845
      },
      {
        "rank": 12,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.83
      },
      {
        "rank": 13,
        "name": "James Chaudry",
        "age": null,
        "rating": 5.682
      },
      {
        "rank": 14,
        "name": "Jasper Schaadt",
        "age": null,
        "rating": 5.651
      },
      {
        "rank": 15,
        "name": "Mikołaj Biedermann",
        "age": null,
        "rating": 5.651
      },
      {
        "rank": 16,
        "name": "Claudio Quinones Garcia",
        "age": null,
        "rating": 5.643
      },
      {
        "rank": 17,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.642
      },
      {
        "rank": 18,
        "name": "Mikar Fisher",
        "age": null,
        "rating": 5.61
      },
      {
        "rank": 19,
        "name": "Rosen Naydenov",
        "age": null,
        "rating": 5.567
      },
      {
        "rank": 20,
        "name": "Ignasi De Rueda",
        "age": null,
        "rating": 5.559
      },
      {
        "rank": 21,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.556
      },
      {
        "rank": 22,
        "name": "Jorge Rodríguez Agudo",
        "age": null,
        "rating": 5.525
      },
      {
        "rank": 23,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.524
      },
      {
        "rank": 24,
        "name": "Bartosz Karbownik",
        "age": null,
        "rating": 5.494
      },
      {
        "rank": 25,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.48
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.764
      },
      {
        "rank": 2,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.663
      },
      {
        "rank": 3,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 5.661
      },
      {
        "rank": 4,
        "name": "Salome Devidze",
        "age": null,
        "rating": 5.648
      },
      {
        "rank": 5,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.534
      },
      {
        "rank": 6,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.464
      },
      {
        "rank": 7,
        "name": "Katie Morris",
        "age": null,
        "rating": 5.401
      },
      {
        "rank": 8,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.386
      },
      {
        "rank": 9,
        "name": "Caroline Nothnagel",
        "age": null,
        "rating": 5.318
      },
      {
        "rank": 10,
        "name": "Marina Alcaide",
        "age": null,
        "rating": 5.289
      },
      {
        "rank": 11,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.249
      },
      {
        "rank": 12,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.17
      },
      {
        "rank": 13,
        "name": "Alma Thell Lenntorp",
        "age": null,
        "rating": 5.168
      },
      {
        "rank": 14,
        "name": "Pialena Ander",
        "age": null,
        "rating": 5.073
      },
      {
        "rank": 15,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.065
      },
      {
        "rank": 16,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 5.043
      },
      {
        "rank": 17,
        "name": "Mireia Rh",
        "age": null,
        "rating": 5.025
      },
      {
        "rank": 18,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.023
      },
      {
        "rank": 19,
        "name": "Marta Zajac",
        "age": null,
        "rating": 4.992
      },
      {
        "rank": 20,
        "name": "Isabelle Papazyan",
        "age": null,
        "rating": 4.957
      },
      {
        "rank": 21,
        "name": "Martina Frantova",
        "age": null,
        "rating": 4.951
      },
      {
        "rank": 22,
        "name": "Mollie Knaggs",
        "age": null,
        "rating": 4.95
      },
      {
        "rank": 23,
        "name": "Stephanie Scimone",
        "age": null,
        "rating": 4.845
      },
      {
        "rank": 24,
        "name": "Paula Rives Palau",
        "age": null,
        "rating": 4.826
      },
      {
        "rank": 25,
        "name": "Rocio Cardo Rodriguez",
        "age": null,
        "rating": 4.824
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

export const DUPR_LAST_UPDATED = "2026-06-15";
