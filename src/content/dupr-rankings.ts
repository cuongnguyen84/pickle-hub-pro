/**
 * DUPR rankings snapshot — parsed from www.dupr.com on 2026-07-02.
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
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 6.317
      },
      {
        "rank": 2,
        "name": "Jonathan Truong",
        "age": null,
        "rating": 6.31
      },
      {
        "rank": 3,
        "name": "Quang Duong",
        "age": null,
        "rating": 6.245
      },
      {
        "rank": 4,
        "name": "Yuta Funemizu",
        "age": null,
        "rating": 6.243
      },
      {
        "rank": 5,
        "name": "Len Yang",
        "age": null,
        "rating": 6.107
      },
      {
        "rank": 6,
        "name": "Quan Do",
        "age": null,
        "rating": 6.042
      },
      {
        "rank": 7,
        "name": "Thomas Yu",
        "age": null,
        "rating": 6.015
      },
      {
        "rank": 8,
        "name": "Altaf Merchant",
        "age": null,
        "rating": 5.994
      },
      {
        "rank": 9,
        "name": "Harsh Mehta",
        "age": null,
        "rating": 5.942
      },
      {
        "rank": 10,
        "name": "Kailas Shekar",
        "age": null,
        "rating": 5.941
      },
      {
        "rank": 11,
        "name": "Sanil Jagtiani",
        "age": null,
        "rating": 5.913
      },
      {
        "rank": 12,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.911
      },
      {
        "rank": 13,
        "name": "Eric Roddy",
        "age": null,
        "rating": 5.905
      },
      {
        "rank": 14,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.898
      },
      {
        "rank": 15,
        "name": "Eunggwon Kim",
        "age": null,
        "rating": 5.892
      },
      {
        "rank": 16,
        "name": "Daniel Moore",
        "age": null,
        "rating": 5.876
      },
      {
        "rank": 17,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.849
      },
      {
        "rank": 18,
        "name": "Phuc Huynh",
        "age": null,
        "rating": 5.848
      },
      {
        "rank": 19,
        "name": "Santhosh Narayanan",
        "age": null,
        "rating": 5.832
      },
      {
        "rank": 20,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.83
      },
      {
        "rank": 21,
        "name": "Truong Hien",
        "age": null,
        "rating": 5.823
      },
      {
        "rank": 22,
        "name": "James Yu",
        "age": null,
        "rating": 5.792
      },
      {
        "rank": 23,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.786
      },
      {
        "rank": 24,
        "name": "Kenneth Lee",
        "age": null,
        "rating": 5.745
      },
      {
        "rank": 25,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 5.738
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Aibika Kalsarieva",
        "age": null,
        "rating": 5.854
      },
      {
        "rank": 2,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.839
      },
      {
        "rank": 3,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.816
      },
      {
        "rank": 4,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.807
      },
      {
        "rank": 5,
        "name": "Alix Truong",
        "age": null,
        "rating": 5.774
      },
      {
        "rank": 6,
        "name": "Nicole Eugenio",
        "age": null,
        "rating": 5.685
      },
      {
        "rank": 7,
        "name": "Marisa Ruiz",
        "age": null,
        "rating": 5.674
      },
      {
        "rank": 8,
        "name": "Kara Wheatley",
        "age": null,
        "rating": 5.673
      },
      {
        "rank": 9,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.623
      },
      {
        "rank": 10,
        "name": "Vritti Sethi",
        "age": null,
        "rating": 5.599
      },
      {
        "rank": 11,
        "name": "Natalie Hur",
        "age": null,
        "rating": 5.507
      },
      {
        "rank": 12,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.479
      },
      {
        "rank": 13,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.472
      },
      {
        "rank": 14,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.463
      },
      {
        "rank": 15,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.452
      },
      {
        "rank": 16,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.448
      },
      {
        "rank": 17,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.446
      },
      {
        "rank": 18,
        "name": "Sarah Jane Lim",
        "age": null,
        "rating": 5.424
      },
      {
        "rank": 19,
        "name": "Kai Fen Yi",
        "age": null,
        "rating": 5.416
      },
      {
        "rank": 20,
        "name": "Xiao Yi Wang Beckvall",
        "age": null,
        "rating": 5.387
      },
      {
        "rank": 21,
        "name": "Lyn Yuen Choo",
        "age": null,
        "rating": 5.379
      },
      {
        "rank": 22,
        "name": "Pearl Amalsadiwala",
        "age": null,
        "rating": 5.34
      },
      {
        "rank": 23,
        "name": "Emma Ruoyi Li",
        "age": null,
        "rating": 5.331
      },
      {
        "rank": 24,
        "name": "Sophia Huỳnh Trần Ngọc Nhi",
        "age": null,
        "rating": 5.321
      },
      {
        "rank": 25,
        "name": "Naimi Mehta",
        "age": null,
        "rating": 5.287
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 6.245
      },
      {
        "rank": 2,
        "name": "Phuc Huynh",
        "age": null,
        "rating": 6.207
      },
      {
        "rank": 3,
        "name": "Truong Hien",
        "age": null,
        "rating": 6.062
      },
      {
        "rank": 4,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 6.011
      },
      {
        "rank": 5,
        "name": "Luc Pham",
        "age": null,
        "rating": 6.008
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
        "name": "Dale Kim",
        "age": null,
        "rating": 5.892
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
        "name": "Kenneth Lee",
        "age": null,
        "rating": 5.844
      },
      {
        "rank": 12,
        "name": "Nasa Hatakeyama",
        "age": null,
        "rating": 5.72
      },
      {
        "rank": 13,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.718
      },
      {
        "rank": 14,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.68
      },
      {
        "rank": 15,
        "name": "Giang Trinh",
        "age": null,
        "rating": 5.632
      },
      {
        "rank": 16,
        "name": "Nguyen Hung Anh",
        "age": null,
        "rating": 5.605
      },
      {
        "rank": 17,
        "name": "Kento Tamaki",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 18,
        "name": "Jimmy Liong Kai Long",
        "age": null,
        "rating": 5.566
      },
      {
        "rank": 19,
        "name": "Rohin Rajani",
        "age": null,
        "rating": 5.557
      },
      {
        "rank": 20,
        "name": "Vũ Phạm",
        "age": null,
        "rating": 5.541
      },
      {
        "rank": 21,
        "name": "Minh Le",
        "age": null,
        "rating": 5.54
      },
      {
        "rank": 22,
        "name": "Marco Leung",
        "age": null,
        "rating": 5.468
      },
      {
        "rank": 23,
        "name": "Timothy Foo Yi Thim",
        "age": null,
        "rating": 5.447
      },
      {
        "rank": 24,
        "name": "Arjun Singh",
        "age": null,
        "rating": 5.44
      },
      {
        "rank": 25,
        "name": "Heyonglin",
        "age": null,
        "rating": 5.404
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.664
      },
      {
        "rank": 2,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.607
      },
      {
        "rank": 3,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.586
      },
      {
        "rank": 4,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.582
      },
      {
        "rank": 5,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.536
      },
      {
        "rank": 6,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.387
      },
      {
        "rank": 7,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.377
      },
      {
        "rank": 8,
        "name": "Mihika Yadav",
        "age": null,
        "rating": 5.349
      },
      {
        "rank": 9,
        "name": "Aaliya Ebrahim",
        "age": null,
        "rating": 5.34
      },
      {
        "rank": 10,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.303
      },
      {
        "rank": 11,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.236
      },
      {
        "rank": 12,
        "name": "Albie Huang",
        "age": null,
        "rating": 5.212
      },
      {
        "rank": 13,
        "name": "Kei Sawaki",
        "age": null,
        "rating": 5.171
      },
      {
        "rank": 14,
        "name": "Ying Suet Lam",
        "age": null,
        "rating": 5.087
      },
      {
        "rank": 15,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.086
      },
      {
        "rank": 16,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.065
      },
      {
        "rank": 17,
        "name": "Anna Clarice Patrimonio",
        "age": null,
        "rating": 5.061
      },
      {
        "rank": 18,
        "name": "Ken Tam",
        "age": null,
        "rating": 5.037
      },
      {
        "rank": 19,
        "name": "Virvienica Bejosano",
        "age": null,
        "rating": 5.035
      },
      {
        "rank": 20,
        "name": "Yunqi He",
        "age": null,
        "rating": 5.02
      },
      {
        "rank": 21,
        "name": "Agnimitra Bhavatosh Bhattacharya",
        "age": null,
        "rating": 5.006
      },
      {
        "rank": 22,
        "name": "Lo Pay Jyue",
        "age": null,
        "rating": 4.993
      },
      {
        "rank": 23,
        "name": "Seina Shima",
        "age": null,
        "rating": 4.991
      },
      {
        "rank": 24,
        "name": "Christy Sañosa",
        "age": null,
        "rating": 4.978
      },
      {
        "rank": 25,
        "name": "Sharmada Balu",
        "age": null,
        "rating": 4.958
      }
    ]
  },
  "north-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Ben Johns",
        "age": null,
        "rating": 7.118
      },
      {
        "rank": 2,
        "name": "Jw Johnson",
        "age": null,
        "rating": 7.01
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": null,
        "rating": 6.933
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.881
      },
      {
        "rank": 5,
        "name": "Riley Newman",
        "age": null,
        "rating": 6.688
      },
      {
        "rank": 6,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.614
      },
      {
        "rank": 7,
        "name": "Cj Klinger",
        "age": null,
        "rating": 6.579
      },
      {
        "rank": 8,
        "name": "Will Howells",
        "age": null,
        "rating": 6.555
      },
      {
        "rank": 9,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.542
      },
      {
        "rank": 10,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.488
      },
      {
        "rank": 11,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.451
      },
      {
        "rank": 12,
        "name": "Tyson Mcguffin",
        "age": null,
        "rating": 6.34
      },
      {
        "rank": 13,
        "name": "Augustus Ge",
        "age": null,
        "rating": 6.335
      },
      {
        "rank": 14,
        "name": "Jack Munro",
        "age": null,
        "rating": 6.323
      },
      {
        "rank": 15,
        "name": "Matt Wright",
        "age": null,
        "rating": 6.318
      },
      {
        "rank": 16,
        "name": "Wyatt Stone",
        "age": null,
        "rating": 6.292
      },
      {
        "rank": 17,
        "name": "Maxwell Freeman",
        "age": null,
        "rating": 6.287
      },
      {
        "rank": 18,
        "name": "Michael Loyd",
        "age": null,
        "rating": 6.281
      },
      {
        "rank": 19,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.28
      },
      {
        "rank": 20,
        "name": "Anderson Scarpa",
        "age": null,
        "rating": 6.275
      },
      {
        "rank": 21,
        "name": "Tyler Loong",
        "age": null,
        "rating": 6.275
      },
      {
        "rank": 22,
        "name": "Marshall Brown",
        "age": null,
        "rating": 6.272
      },
      {
        "rank": 23,
        "name": "Travis Rettenmaier",
        "age": null,
        "rating": 6.26
      },
      {
        "rank": 24,
        "name": "Max Manthou",
        "age": null,
        "rating": 6.26
      },
      {
        "rank": 25,
        "name": "Rafa Hewett",
        "age": null,
        "rating": 6.257
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.987
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": null,
        "rating": 6.586
      },
      {
        "rank": 3,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 6.299
      },
      {
        "rank": 4,
        "name": "Hurricane Tyra Black",
        "age": null,
        "rating": 6.298
      },
      {
        "rank": 5,
        "name": "Parris Todd",
        "age": null,
        "rating": 6.261
      },
      {
        "rank": 6,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.243
      },
      {
        "rank": 7,
        "name": "Rachel Rohrabacher",
        "age": null,
        "rating": 6.238
      },
      {
        "rank": 8,
        "name": "Jackie Kawamoto",
        "age": null,
        "rating": 6.22
      },
      {
        "rank": 9,
        "name": "Jade Kawamoto",
        "age": null,
        "rating": 6.201
      },
      {
        "rank": 10,
        "name": "Mariechristine Salvas",
        "age": null,
        "rating": 6.121
      },
      {
        "rank": 11,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.104
      },
      {
        "rank": 12,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 6.103
      },
      {
        "rank": 13,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 6.09
      },
      {
        "rank": 14,
        "name": "Jillian Braverman",
        "age": null,
        "rating": 6.007
      },
      {
        "rank": 15,
        "name": "Etta Tuionetoa",
        "age": null,
        "rating": 6.001
      },
      {
        "rank": 16,
        "name": "Vivian Glozman",
        "age": null,
        "rating": 5.993
      },
      {
        "rank": 17,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.991
      },
      {
        "rank": 18,
        "name": "Lacy Schneemann",
        "age": null,
        "rating": 5.959
      },
      {
        "rank": 19,
        "name": "Meghan Dizon",
        "age": null,
        "rating": 5.935
      },
      {
        "rank": 20,
        "name": "Allison Harris",
        "age": null,
        "rating": 5.902
      },
      {
        "rank": 21,
        "name": "Angela Simon",
        "age": null,
        "rating": 5.894
      },
      {
        "rank": 22,
        "name": "Allyce Jones",
        "age": null,
        "rating": 5.888
      },
      {
        "rank": 23,
        "name": "Christine Maddox",
        "age": null,
        "rating": 5.852
      },
      {
        "rank": 24,
        "name": "Kelsey Matthews",
        "age": null,
        "rating": 5.822
      },
      {
        "rank": 25,
        "name": "Pam Ruoff",
        "age": null,
        "rating": 5.818
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
        "name": "Jack Sock",
        "age": null,
        "rating": 6.533
      },
      {
        "rank": 6,
        "name": "John Goins",
        "age": null,
        "rating": 6.518
      },
      {
        "rank": 7,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.486
      },
      {
        "rank": 8,
        "name": "Zane Ford",
        "age": null,
        "rating": 6.47
      },
      {
        "rank": 9,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.448
      },
      {
        "rank": 10,
        "name": "Dusty Boyer",
        "age": null,
        "rating": 6.354
      },
      {
        "rank": 11,
        "name": "Jw Johnson",
        "age": null,
        "rating": 6.31
      },
      {
        "rank": 12,
        "name": "Tama Shimabukuro",
        "age": null,
        "rating": 6.289
      },
      {
        "rank": 13,
        "name": "Matthew Barlow",
        "age": null,
        "rating": 6.285
      },
      {
        "rank": 14,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.269
      },
      {
        "rank": 15,
        "name": "Adam Harvey",
        "age": null,
        "rating": 6.259
      },
      {
        "rank": 16,
        "name": "Gabriel Joseph",
        "age": null,
        "rating": 6.257
      },
      {
        "rank": 17,
        "name": "Donald Young",
        "age": null,
        "rating": 6.237
      },
      {
        "rank": 18,
        "name": "Ronan Camron",
        "age": null,
        "rating": 6.235
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
        "name": "Brandon French",
        "age": null,
        "rating": 6.15
      },
      {
        "rank": 23,
        "name": "Andre Millet",
        "age": null,
        "rating": 6.128
      },
      {
        "rank": 24,
        "name": "Rafa Hewett",
        "age": null,
        "rating": 6.127
      },
      {
        "rank": 25,
        "name": "Alexander Crum",
        "age": null,
        "rating": 6.121
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
        "rating": 6.043
      },
      {
        "rank": 5,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.004
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
        "name": "Cailyn Campbell",
        "age": null,
        "rating": 5.678
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
        "rating": 5.603
      },
      {
        "rank": 17,
        "name": "Amber Policare",
        "age": null,
        "rating": 5.578
      },
      {
        "rank": 18,
        "name": "Victoria Dimuzio",
        "age": null,
        "rating": 5.548
      },
      {
        "rank": 19,
        "name": "Eileen Wang",
        "age": null,
        "rating": 5.472
      },
      {
        "rank": 20,
        "name": "Liz Truluck",
        "age": null,
        "rating": 5.453
      },
      {
        "rank": 21,
        "name": "Karin Ptaszek-Kochis",
        "age": null,
        "rating": 5.437
      },
      {
        "rank": 22,
        "name": "Jessica Ho",
        "age": null,
        "rating": 5.436
      },
      {
        "rank": 23,
        "name": "Milan Rane",
        "age": null,
        "rating": 5.435
      },
      {
        "rank": 24,
        "name": "Zoey Weil",
        "age": null,
        "rating": 5.405
      },
      {
        "rank": 25,
        "name": "Jada Bui",
        "age": null,
        "rating": 5.399
      }
    ]
  },
  "south-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Gabriel Tardio",
        "age": null,
        "rating": 6.915
      },
      {
        "rank": 2,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.71
      },
      {
        "rank": 3,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.672
      },
      {
        "rank": 4,
        "name": "Nicolas Acevedo",
        "age": null,
        "rating": 6.536
      },
      {
        "rank": 5,
        "name": "Pablo Tellez",
        "age": null,
        "rating": 6.395
      },
      {
        "rank": 6,
        "name": "Bruno Faletto",
        "age": null,
        "rating": 6.142
      },
      {
        "rank": 7,
        "name": "Juan Benitez",
        "age": null,
        "rating": 6.056
      },
      {
        "rank": 8,
        "name": "Jaime Oncins",
        "age": null,
        "rating": 6.054
      },
      {
        "rank": 9,
        "name": "Juan Varon",
        "age": null,
        "rating": 6.009
      },
      {
        "rank": 10,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 5.985
      },
      {
        "rank": 11,
        "name": "Mario Barrientos",
        "age": null,
        "rating": 5.864
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
        "name": "Tobias Golberg",
        "age": null,
        "rating": 5.646
      },
      {
        "rank": 16,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.594
      },
      {
        "rank": 17,
        "name": "Miguel Alda",
        "age": null,
        "rating": 5.572
      },
      {
        "rank": 18,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.519
      },
      {
        "rank": 19,
        "name": "Alex Simon",
        "age": null,
        "rating": 5.488
      },
      {
        "rank": 20,
        "name": "Armando Ferreira",
        "age": null,
        "rating": 5.475
      },
      {
        "rank": 21,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.449
      },
      {
        "rank": 22,
        "name": "Juan Medina",
        "age": null,
        "rating": 5.445
      },
      {
        "rank": 23,
        "name": "Ignacio De Elia",
        "age": null,
        "rating": 5.421
      },
      {
        "rank": 24,
        "name": "Federico Nani",
        "age": null,
        "rating": 5.414
      },
      {
        "rank": 25,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.367
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 6.028
      },
      {
        "rank": 2,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 6.024
      },
      {
        "rank": 3,
        "name": "Lucia White",
        "age": null,
        "rating": 5.694
      },
      {
        "rank": 4,
        "name": "Pierina Imparato",
        "age": null,
        "rating": 5.452
      },
      {
        "rank": 5,
        "name": "Gabriela Katz",
        "age": null,
        "rating": 5.37
      },
      {
        "rank": 6,
        "name": "Alexa Quintanilla",
        "age": null,
        "rating": 5.301
      },
      {
        "rank": 7,
        "name": "Florencia Rossi Luque",
        "age": null,
        "rating": 5.24
      },
      {
        "rank": 8,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 5.185
      },
      {
        "rank": 9,
        "name": "Nicole Lange Beidacki",
        "age": null,
        "rating": 5.161
      },
      {
        "rank": 10,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.094
      },
      {
        "rank": 11,
        "name": "Bequi Barros Behar Luizelli",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 12,
        "name": "Tatiana Ruhl",
        "age": null,
        "rating": 5.011
      },
      {
        "rank": 13,
        "name": "Barbara Lopez",
        "age": null,
        "rating": 4.958
      },
      {
        "rank": 14,
        "name": "Ali Quintero",
        "age": null,
        "rating": 4.935
      },
      {
        "rank": 15,
        "name": "Dayana Fahey",
        "age": null,
        "rating": 4.916
      },
      {
        "rank": 16,
        "name": "Arianna Raga",
        "age": null,
        "rating": 4.883
      },
      {
        "rank": 17,
        "name": "Patricia Medrado",
        "age": null,
        "rating": 4.876
      },
      {
        "rank": 18,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.866
      },
      {
        "rank": 19,
        "name": "Valentina Martin",
        "age": null,
        "rating": 4.833
      },
      {
        "rank": 20,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.833
      },
      {
        "rank": 21,
        "name": "Mariana Jimenez",
        "age": null,
        "rating": 4.83
      },
      {
        "rank": 22,
        "name": "Nathalia Garay",
        "age": null,
        "rating": 4.819
      },
      {
        "rank": 23,
        "name": "Eliza  De Oliveira Rocha",
        "age": null,
        "rating": 4.781
      },
      {
        "rank": 24,
        "name": "Katie Neils",
        "age": null,
        "rating": 4.754
      },
      {
        "rank": 25,
        "name": "Karina Salles",
        "age": null,
        "rating": 4.752
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.772
      },
      {
        "rank": 2,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.208
      },
      {
        "rank": 3,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.204
      },
      {
        "rank": 4,
        "name": "Juan Benitez",
        "age": null,
        "rating": 5.857
      },
      {
        "rank": 5,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.84
      },
      {
        "rank": 6,
        "name": "Nicolas Almeida",
        "age": null,
        "rating": 5.467
      },
      {
        "rank": 7,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.444
      },
      {
        "rank": 8,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.402
      },
      {
        "rank": 9,
        "name": "Nasser Pena Rios",
        "age": null,
        "rating": 5.289
      },
      {
        "rank": 10,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.287
      },
      {
        "rank": 11,
        "name": "Armando Ferreira",
        "age": null,
        "rating": 5.279
      },
      {
        "rank": 12,
        "name": "Rafael Munehide Kayo",
        "age": null,
        "rating": 5.252
      },
      {
        "rank": 13,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.251
      },
      {
        "rank": 14,
        "name": "Ayke Rodrigues",
        "age": null,
        "rating": 5.213
      },
      {
        "rank": 15,
        "name": "Lucas Severo",
        "age": null,
        "rating": 5.163
      },
      {
        "rank": 16,
        "name": "Thiago Soto",
        "age": null,
        "rating": 5.143
      },
      {
        "rank": 17,
        "name": "Nicolas Yannuzzi",
        "age": null,
        "rating": 5.119
      },
      {
        "rank": 18,
        "name": "João Pedro  Agulha Fernandes",
        "age": null,
        "rating": 5.102
      },
      {
        "rank": 19,
        "name": "Bruno Semino",
        "age": null,
        "rating": 5.087
      },
      {
        "rank": 20,
        "name": "Bernardo Valdes",
        "age": null,
        "rating": 5.068
      },
      {
        "rank": 21,
        "name": "Tony Ottamendi",
        "age": null,
        "rating": 5.043
      },
      {
        "rank": 22,
        "name": "Rodrigo  Borrero",
        "age": null,
        "rating": 5.017
      },
      {
        "rank": 23,
        "name": "Juan Pablo Pinilla",
        "age": null,
        "rating": 5.011
      },
      {
        "rank": 24,
        "name": "Eduardo Correia",
        "age": null,
        "rating": 5.006
      },
      {
        "rank": 25,
        "name": "Bernardo Gasparin",
        "age": null,
        "rating": 5.002
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
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.95
      },
      {
        "rank": 3,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 4.782
      },
      {
        "rank": 4,
        "name": "Isadora Campi",
        "age": null,
        "rating": 4.748
      },
      {
        "rank": 5,
        "name": "Sofia Kelbert",
        "age": null,
        "rating": 4.629
      },
      {
        "rank": 6,
        "name": "Míria Nascimento",
        "age": null,
        "rating": 4.551
      },
      {
        "rank": 7,
        "name": "Camila Militao",
        "age": null,
        "rating": 4.479
      },
      {
        "rank": 8,
        "name": "Ali Quintero",
        "age": null,
        "rating": 4.474
      },
      {
        "rank": 9,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.402
      },
      {
        "rank": 10,
        "name": "Delfina Debenedetti",
        "age": null,
        "rating": 4.336
      },
      {
        "rank": 11,
        "name": "Ana Sánchez",
        "age": null,
        "rating": 4.274
      },
      {
        "rank": 12,
        "name": "Carolina Ledesma",
        "age": null,
        "rating": 4.256
      },
      {
        "rank": 13,
        "name": "Jennifer  Pedraza",
        "age": null,
        "rating": 4.239
      },
      {
        "rank": 14,
        "name": "Javiera Elena Escobar",
        "age": null,
        "rating": 4.219
      },
      {
        "rank": 15,
        "name": "Mariana Negreiros Mariano",
        "age": null,
        "rating": 4.207
      },
      {
        "rank": 16,
        "name": "Mia Alva",
        "age": null,
        "rating": 4.012
      },
      {
        "rank": 17,
        "name": "Valeria Mayta",
        "age": null,
        "rating": 4.003
      },
      {
        "rank": 18,
        "name": "Viviane Rentroia",
        "age": null,
        "rating": 3.979
      },
      {
        "rank": 19,
        "name": "Alejandra Báez",
        "age": null,
        "rating": 3.957
      },
      {
        "rank": 20,
        "name": "Michelle Hasson",
        "age": null,
        "rating": 3.956
      },
      {
        "rank": 21,
        "name": "Ana Paula Bergmann",
        "age": null,
        "rating": 3.905
      },
      {
        "rank": 22,
        "name": "Ana Frascheri",
        "age": null,
        "rating": 3.861
      },
      {
        "rank": 23,
        "name": "Gabriela Mayta Mallqui",
        "age": null,
        "rating": 3.753
      },
      {
        "rank": 24,
        "name": "Mariele Cristina  Stamm",
        "age": null,
        "rating": 3.752
      },
      {
        "rank": 25,
        "name": "Lilia Vogel De Castilho",
        "age": null,
        "rating": 3.697
      }
    ]
  },
  "australia-oceania": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "George Wall",
        "age": null,
        "rating": 6.068
      },
      {
        "rank": 2,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 6.026
      },
      {
        "rank": 3,
        "name": "Andre Mick",
        "age": null,
        "rating": 5.949
      },
      {
        "rank": 4,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.896
      },
      {
        "rank": 5,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.774
      },
      {
        "rank": 6,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.745
      },
      {
        "rank": 7,
        "name": "Robert Claveria Stirling",
        "age": null,
        "rating": 5.734
      },
      {
        "rank": 8,
        "name": "Vuk Velickovic",
        "age": null,
        "rating": 5.674
      },
      {
        "rank": 9,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.66
      },
      {
        "rank": 10,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.653
      },
      {
        "rank": 11,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.597
      },
      {
        "rank": 12,
        "name": "Brian  Tran",
        "age": null,
        "rating": 5.562
      },
      {
        "rank": 13,
        "name": "Morgan Evans",
        "age": null,
        "rating": 5.543
      },
      {
        "rank": 14,
        "name": "Ciaran Lavers",
        "age": null,
        "rating": 5.45
      },
      {
        "rank": 15,
        "name": "Martin Clark",
        "age": null,
        "rating": 5.448
      },
      {
        "rank": 16,
        "name": "Ryan Morris",
        "age": null,
        "rating": 5.394
      },
      {
        "rank": 17,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.384
      },
      {
        "rank": 18,
        "name": "Chris Turvey",
        "age": null,
        "rating": 5.374
      },
      {
        "rank": 19,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 5.366
      },
      {
        "rank": 20,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.335
      },
      {
        "rank": 21,
        "name": "Jai Grewal",
        "age": null,
        "rating": 5.312
      },
      {
        "rank": 22,
        "name": "Will Dewhirst",
        "age": null,
        "rating": 5.309
      },
      {
        "rank": 23,
        "name": "Tony Field",
        "age": null,
        "rating": 5.298
      },
      {
        "rank": 24,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.292
      },
      {
        "rank": 25,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.292
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 6.049
      },
      {
        "rank": 2,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.92
      },
      {
        "rank": 3,
        "name": "Somer Dallabona",
        "age": null,
        "rating": 5.752
      },
      {
        "rank": 4,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.742
      },
      {
        "rank": 5,
        "name": "Seone Mendez",
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
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.684
      },
      {
        "rank": 8,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.669
      },
      {
        "rank": 9,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.581
      },
      {
        "rank": 10,
        "name": "Talia Saunders",
        "age": null,
        "rating": 5.476
      },
      {
        "rank": 11,
        "name": "Sarah Burr",
        "age": null,
        "rating": 5.402
      },
      {
        "rank": 12,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 5.325
      },
      {
        "rank": 13,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 5.32
      },
      {
        "rank": 14,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.269
      },
      {
        "rank": 15,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.254
      },
      {
        "rank": 16,
        "name": "Karen Denman",
        "age": null,
        "rating": 5.231
      },
      {
        "rank": 17,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 5.222
      },
      {
        "rank": 18,
        "name": "Brittany Yang",
        "age": null,
        "rating": 5.176
      },
      {
        "rank": 19,
        "name": "Lara Giltinan",
        "age": null,
        "rating": 5.109
      },
      {
        "rank": 20,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 5.102
      },
      {
        "rank": 21,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.05
      },
      {
        "rank": 22,
        "name": "Belinda Crane",
        "age": null,
        "rating": 5.035
      },
      {
        "rank": 23,
        "name": "Tyra Calderwood",
        "age": null,
        "rating": 5.034
      },
      {
        "rank": 24,
        "name": "Katerina Valos",
        "age": null,
        "rating": 5.017
      },
      {
        "rank": 25,
        "name": "Rosa Morris",
        "age": null,
        "rating": 5.005
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.747
      },
      {
        "rank": 2,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.712
      },
      {
        "rank": 3,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.481
      },
      {
        "rank": 4,
        "name": "Andy Van Der Vyver",
        "age": null,
        "rating": 5.432
      },
      {
        "rank": 5,
        "name": "Brian  Tran",
        "age": null,
        "rating": 5.373
      },
      {
        "rank": 6,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.354
      },
      {
        "rank": 7,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.252
      },
      {
        "rank": 8,
        "name": "Ethan Chung",
        "age": null,
        "rating": 5.235
      },
      {
        "rank": 9,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.208
      },
      {
        "rank": 10,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.2
      },
      {
        "rank": 11,
        "name": "Matthew Kouznetsov",
        "age": null,
        "rating": 5.17
      },
      {
        "rank": 12,
        "name": "James Wilson",
        "age": null,
        "rating": 5.169
      },
      {
        "rank": 13,
        "name": "Henrik Traskin",
        "age": null,
        "rating": 5.153
      },
      {
        "rank": 14,
        "name": "Kyron Pinter",
        "age": null,
        "rating": 5.131
      },
      {
        "rank": 15,
        "name": "Ethan Butson",
        "age": null,
        "rating": 5.125
      },
      {
        "rank": 16,
        "name": "Joshua Barber",
        "age": null,
        "rating": 5.122
      },
      {
        "rank": 17,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.101
      },
      {
        "rank": 18,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 5.061
      },
      {
        "rank": 19,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.046
      },
      {
        "rank": 20,
        "name": "Joshua Chia",
        "age": null,
        "rating": 5.031
      },
      {
        "rank": 21,
        "name": "Ryan Morris",
        "age": null,
        "rating": 5.03
      },
      {
        "rank": 22,
        "name": "Liam Lamb",
        "age": null,
        "rating": 5.027
      },
      {
        "rank": 23,
        "name": "Nigel Lee",
        "age": null,
        "rating": 5.018
      },
      {
        "rank": 24,
        "name": "Sam Gibbs",
        "age": null,
        "rating": 4.961
      },
      {
        "rank": 25,
        "name": "Ashton Chan",
        "age": null,
        "rating": 4.955
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
        "rating": 5.785
      },
      {
        "rank": 3,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.622
      },
      {
        "rank": 4,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.539
      },
      {
        "rank": 5,
        "name": "Lara Giltinan",
        "age": null,
        "rating": 5.426
      },
      {
        "rank": 6,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.388
      },
      {
        "rank": 7,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.331
      },
      {
        "rank": 8,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.293
      },
      {
        "rank": 9,
        "name": "Jasmine Almaguer",
        "age": null,
        "rating": 5.166
      },
      {
        "rank": 10,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 5.16
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
        "rating": 5.046
      },
      {
        "rank": 13,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 5.023
      },
      {
        "rank": 14,
        "name": "Ange Green",
        "age": null,
        "rating": 5.013
      },
      {
        "rank": 15,
        "name": "Bee Horsley",
        "age": null,
        "rating": 4.957
      },
      {
        "rank": 16,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 4.949
      },
      {
        "rank": 17,
        "name": "Simone Kessell",
        "age": null,
        "rating": 4.948
      },
      {
        "rank": 18,
        "name": "Brittany Yang",
        "age": null,
        "rating": 4.934
      },
      {
        "rank": 19,
        "name": "Nives Baric",
        "age": null,
        "rating": 4.931
      },
      {
        "rank": 20,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 4.926
      },
      {
        "rank": 21,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 4.914
      },
      {
        "rank": 22,
        "name": "Karen Denman",
        "age": null,
        "rating": 4.875
      },
      {
        "rank": 23,
        "name": "Emily Martin",
        "age": null,
        "rating": 4.873
      },
      {
        "rank": 24,
        "name": "Rosa Morris",
        "age": null,
        "rating": 4.861
      },
      {
        "rank": 25,
        "name": "Katerina Valos",
        "age": null,
        "rating": 4.81
      }
    ]
  },
  "europe": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Andrei Daescu",
        "age": null,
        "rating": 6.898
      },
      {
        "rank": 2,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 6.629
      },
      {
        "rank": 3,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.547
      },
      {
        "rank": 4,
        "name": "Dekel Bar",
        "age": null,
        "rating": 6.512
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
        "rating": 6.297
      },
      {
        "rank": 7,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.227
      },
      {
        "rank": 8,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 6.21
      },
      {
        "rank": 9,
        "name": "Dj Young",
        "age": null,
        "rating": 6.094
      },
      {
        "rank": 10,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 6.094
      },
      {
        "rank": 11,
        "name": "Oscar Serra",
        "age": null,
        "rating": 6.09
      },
      {
        "rank": 12,
        "name": "Tom Protzek",
        "age": null,
        "rating": 5.982
      },
      {
        "rank": 13,
        "name": "Henry Boyle",
        "age": null,
        "rating": 5.944
      },
      {
        "rank": 14,
        "name": "Jaime Lladro",
        "age": null,
        "rating": 5.919
      },
      {
        "rank": 15,
        "name": "Stefan Auvergne",
        "age": null,
        "rating": 5.913
      },
      {
        "rank": 16,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.906
      },
      {
        "rank": 17,
        "name": "Domenico Geminiani",
        "age": null,
        "rating": 5.859
      },
      {
        "rank": 18,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.858
      },
      {
        "rank": 19,
        "name": "Louis Laville",
        "age": null,
        "rating": 5.846
      },
      {
        "rank": 20,
        "name": "Patrick Smith",
        "age": null,
        "rating": 5.837
      },
      {
        "rank": 21,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 5.785
      },
      {
        "rank": 22,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.783
      },
      {
        "rank": 23,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.78
      },
      {
        "rank": 24,
        "name": "Mark Growcott",
        "age": null,
        "rating": 5.778
      },
      {
        "rank": 25,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.766
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Tina Pisnik",
        "age": null,
        "rating": 6.215
      },
      {
        "rank": 2,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 6.027
      },
      {
        "rank": 3,
        "name": "Megan Fudge",
        "age": null,
        "rating": 5.986
      },
      {
        "rank": 4,
        "name": "Ewa Radzikowska",
        "age": null,
        "rating": 5.855
      },
      {
        "rank": 5,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.74
      },
      {
        "rank": 6,
        "name": "Daria Walczak",
        "age": null,
        "rating": 5.735
      },
      {
        "rank": 7,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.734
      },
      {
        "rank": 8,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.729
      },
      {
        "rank": 9,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.714
      },
      {
        "rank": 10,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.69
      },
      {
        "rank": 11,
        "name": "Lucy Kovalova",
        "age": null,
        "rating": 5.65
      },
      {
        "rank": 12,
        "name": "Paula Rives Palau",
        "age": null,
        "rating": 5.635
      },
      {
        "rank": 13,
        "name": "Martina Frantova",
        "age": null,
        "rating": 5.585
      },
      {
        "rank": 14,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.58
      },
      {
        "rank": 15,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.575
      },
      {
        "rank": 16,
        "name": "Maria Klokotzky",
        "age": null,
        "rating": 5.574
      },
      {
        "rank": 17,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.543
      },
      {
        "rank": 18,
        "name": "Andrea Olson",
        "age": null,
        "rating": 5.534
      },
      {
        "rank": 19,
        "name": "Molly Odonoghue",
        "age": null,
        "rating": 5.519
      },
      {
        "rank": 20,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 5.472
      },
      {
        "rank": 21,
        "name": "Glauka Carvajal Lane",
        "age": null,
        "rating": 5.458
      },
      {
        "rank": 22,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.448
      },
      {
        "rank": 23,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.448
      },
      {
        "rank": 24,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.443
      },
      {
        "rank": 25,
        "name": "Tea Pejic",
        "age": null,
        "rating": 5.413
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
        "name": "Tom Protzek",
        "age": null,
        "rating": 6.102
      },
      {
        "rank": 6,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 6.023
      },
      {
        "rank": 7,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 5.971
      },
      {
        "rank": 8,
        "name": "Emilien  Burnel",
        "age": null,
        "rating": 5.966
      },
      {
        "rank": 9,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.958
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
        "rating": 5.864
      },
      {
        "rank": 12,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.81
      },
      {
        "rank": 13,
        "name": "Mikar Fisher",
        "age": null,
        "rating": 5.784
      },
      {
        "rank": 14,
        "name": "Shay Hugo",
        "age": null,
        "rating": 5.661
      },
      {
        "rank": 15,
        "name": "James Chaudry",
        "age": null,
        "rating": 5.645
      },
      {
        "rank": 16,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.642
      },
      {
        "rank": 17,
        "name": "Ignasi De Rueda",
        "age": null,
        "rating": 5.64
      },
      {
        "rank": 18,
        "name": "Claudio Quinones Garcia",
        "age": null,
        "rating": 5.637
      },
      {
        "rank": 19,
        "name": "Jorge Rodríguez Agudo",
        "age": null,
        "rating": 5.622
      },
      {
        "rank": 20,
        "name": "Mikołaj Biedermann",
        "age": null,
        "rating": 5.606
      },
      {
        "rank": 21,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.602
      },
      {
        "rank": 22,
        "name": "Jasper Schaadt",
        "age": null,
        "rating": 5.601
      },
      {
        "rank": 23,
        "name": "Bartosz Karbownik",
        "age": null,
        "rating": 5.566
      },
      {
        "rank": 24,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.545
      },
      {
        "rank": 25,
        "name": "Mauro Garcia Sanchez",
        "age": null,
        "rating": 5.543
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
        "name": "Roos Van Reek",
        "age": null,
        "rating": 5.64
      },
      {
        "rank": 3,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 4,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.593
      },
      {
        "rank": 5,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.534
      },
      {
        "rank": 6,
        "name": "Katie Morris",
        "age": null,
        "rating": 5.49
      },
      {
        "rank": 7,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.438
      },
      {
        "rank": 8,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.43
      },
      {
        "rank": 9,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.386
      },
      {
        "rank": 10,
        "name": "Caroline Nothnagel",
        "age": null,
        "rating": 5.373
      },
      {
        "rank": 11,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.309
      },
      {
        "rank": 12,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.249
      },
      {
        "rank": 13,
        "name": "Maria Fernandez Costantino",
        "age": null,
        "rating": 5.195
      },
      {
        "rank": 14,
        "name": "Alma Thell Lenntorp",
        "age": null,
        "rating": 5.168
      },
      {
        "rank": 15,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.135
      },
      {
        "rank": 16,
        "name": "Francesca  Rumi",
        "age": null,
        "rating": 5.101
      },
      {
        "rank": 17,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.065
      },
      {
        "rank": 18,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.064
      },
      {
        "rank": 19,
        "name": "Naomi De Hart",
        "age": null,
        "rating": 5.045
      },
      {
        "rank": 20,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 5.043
      },
      {
        "rank": 21,
        "name": "Pialena Ander",
        "age": null,
        "rating": 5.037
      },
      {
        "rank": 22,
        "name": "Emilia Richter",
        "age": null,
        "rating": 5.036
      },
      {
        "rank": 23,
        "name": "Marina Alcaide",
        "age": null,
        "rating": 5.018
      },
      {
        "rank": 24,
        "name": "Isabelle Papazyan",
        "age": null,
        "rating": 5.006
      },
      {
        "rank": 25,
        "name": "Mireia Rh",
        "age": null,
        "rating": 5.004
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

export const DUPR_LAST_UPDATED = "2026-07-02";
