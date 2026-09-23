/**
 * DUPR rankings snapshot — parsed from www.dupr.com on 2026-08-31.
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
        "rating": 7.121
      },
      {
        "rank": 2,
        "name": "JW Johnson",
        "age": 24,
        "rating": 7.006
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": 20,
        "rating": 6.943
      },
      {
        "rank": 4,
        "name": "Gabriel Tardio",
        "age": 20,
        "rating": 6.923
      },
      {
        "rank": 5,
        "name": "Andrei Daescu",
        "age": 37,
        "rating": 6.889
      },
      {
        "rank": 6,
        "name": "Christian Alshon",
        "age": 26,
        "rating": 6.881
      },
      {
        "rank": 7,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.708
      },
      {
        "rank": 8,
        "name": "Riley Newman",
        "age": 33,
        "rating": 6.688
      },
      {
        "rank": 9,
        "name": "Eric Oncins",
        "age": 24,
        "rating": 6.688
      },
      {
        "rank": 10,
        "name": "Jay Devilliers",
        "age": 31,
        "rating": 6.616
      },
      {
        "rank": 11,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.598
      },
      {
        "rank": 12,
        "name": "CJ Klinger",
        "age": 20,
        "rating": 6.563
      },
      {
        "rank": 13,
        "name": "Nicolas Acevedo",
        "age": 26,
        "rating": 6.547
      },
      {
        "rank": 14,
        "name": "Will Howells",
        "age": 27,
        "rating": 6.546
      },
      {
        "rank": 15,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.544
      },
      {
        "rank": 16,
        "name": "Jack Sock",
        "age": 33,
        "rating": 6.542
      },
      {
        "rank": 17,
        "name": "Dylan Frazier",
        "age": 24,
        "rating": 6.507
      },
      {
        "rank": 18,
        "name": "Dekel Bar",
        "age": 33,
        "rating": 6.494
      },
      {
        "rank": 19,
        "name": "Hunter Johnson",
        "age": 32,
        "rating": 6.451
      },
      {
        "rank": 20,
        "name": "Jaume Martinez Vich",
        "age": 32,
        "rating": 6.392
      },
      {
        "rank": 21,
        "name": "Pablo Tellez",
        "age": 31,
        "rating": 6.385
      },
      {
        "rank": 22,
        "name": "Augustus Ge",
        "age": 29,
        "rating": 6.345
      },
      {
        "rank": 23,
        "name": "Tyson Mcguffin",
        "age": 37,
        "rating": 6.328
      },
      {
        "rank": 24,
        "name": "Jack Munro",
        "age": 22,
        "rating": 6.323
      },
      {
        "rank": 25,
        "name": "Matt Wright",
        "age": 49,
        "rating": 6.318
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.987
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": 26,
        "rating": 6.598
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": 25,
        "rating": 6.306
      },
      {
        "rank": 4,
        "name": "Jorja Johnson",
        "age": 19,
        "rating": 6.298
      },
      {
        "rank": 5,
        "name": "Parris Todd",
        "age": 28,
        "rating": 6.273
      },
      {
        "rank": 6,
        "name": "Sofia Sewing",
        "age": 26,
        "rating": 6.262
      },
      {
        "rank": 7,
        "name": "Rachel Rohrabacher",
        "age": 29,
        "rating": 6.238
      },
      {
        "rank": 8,
        "name": "Jackie Kawamoto",
        "age": 30,
        "rating": 6.231
      },
      {
        "rank": 9,
        "name": "Tina Pisnik",
        "age": 45,
        "rating": 6.228
      },
      {
        "rank": 10,
        "name": "Jade Kawamoto",
        "age": 30,
        "rating": 6.188
      },
      {
        "rank": 11,
        "name": "Mariechristine Salvas",
        "age": 38,
        "rating": 6.121
      },
      {
        "rank": 12,
        "name": "Kate Fahey",
        "age": 29,
        "rating": 6.115
      },
      {
        "rank": 13,
        "name": "Katerina Stewart",
        "age": 28,
        "rating": 6.103
      },
      {
        "rank": 14,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 6.082
      },
      {
        "rank": 15,
        "name": "Mariana Humberg",
        "age": 30,
        "rating": 6.042
      },
      {
        "rank": 16,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 6.027
      },
      {
        "rank": 17,
        "name": "Danni-Elle Townsend",
        "age": 23,
        "rating": 6.025
      },
      {
        "rank": 18,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": 50,
        "rating": 6.024
      },
      {
        "rank": 19,
        "name": "Jillian Braverman",
        "age": 36,
        "rating": 6.007
      },
      {
        "rank": 20,
        "name": "Etta Tuionetoa",
        "age": 34,
        "rating": 6.002
      },
      {
        "rank": 21,
        "name": "Vivian Glozman",
        "age": 26,
        "rating": 5.993
      },
      {
        "rank": 22,
        "name": "Megan Fudge",
        "age": 38,
        "rating": 5.986
      },
      {
        "rank": 23,
        "name": "Lacy Schneemann",
        "age": 29,
        "rating": 5.974
      },
      {
        "rank": 24,
        "name": "Meghan Dizon",
        "age": 33,
        "rating": 5.946
      },
      {
        "rank": 25,
        "name": "Bobbi Oshiro",
        "age": 32,
        "rating": 5.942
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
        "rating": 6.772
      },
      {
        "rank": 3,
        "name": "Hunter Johnson",
        "age": 32,
        "rating": 6.699
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": 26,
        "rating": 6.581
      },
      {
        "rank": 5,
        "name": "Jack Sock",
        "age": 33,
        "rating": 6.533
      },
      {
        "rank": 6,
        "name": "John Goins",
        "age": 18,
        "rating": 6.518
      },
      {
        "rank": 7,
        "name": "Ammar Wazir",
        "age": 23,
        "rating": 6.517
      },
      {
        "rank": 8,
        "name": "Roscoe Bellamy",
        "age": 26,
        "rating": 6.486
      },
      {
        "rank": 9,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.448
      },
      {
        "rank": 10,
        "name": "Zane Ford",
        "age": 21,
        "rating": 6.431
      },
      {
        "rank": 11,
        "name": "Jaume Martinez Vich",
        "age": 32,
        "rating": 6.424
      },
      {
        "rank": 12,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.395
      },
      {
        "rank": 13,
        "name": "Dusty Boyer",
        "age": 33,
        "rating": 6.354
      },
      {
        "rank": 14,
        "name": "JW Johnson",
        "age": 24,
        "rating": 6.31
      },
      {
        "rank": 15,
        "name": "Mohaned Alhouni",
        "age": 30,
        "rating": 6.292
      },
      {
        "rank": 16,
        "name": "Matthew Barlow",
        "age": 32,
        "rating": 6.285
      },
      {
        "rank": 17,
        "name": "Dylan Frazier",
        "age": 24,
        "rating": 6.269
      },
      {
        "rank": 18,
        "name": "Adam Harvey",
        "age": 25,
        "rating": 6.259
      },
      {
        "rank": 19,
        "name": "Gabriel Joseph",
        "age": 29,
        "rating": 6.257
      },
      {
        "rank": 20,
        "name": "Nam Ly Hoang",
        "age": 29,
        "rating": 6.245
      },
      {
        "rank": 21,
        "name": "Luca Mack",
        "age": 26,
        "rating": 6.244
      },
      {
        "rank": 22,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.24
      },
      {
        "rank": 23,
        "name": "Donald Young",
        "age": 36,
        "rating": 6.237
      },
      {
        "rank": 24,
        "name": "Ronan Camron",
        "age": 21,
        "rating": 6.235
      },
      {
        "rank": 25,
        "name": "Yates Johnson",
        "age": 32,
        "rating": 6.218
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
        "rating": 6.043
      },
      {
        "rank": 5,
        "name": "Sofia Sewing",
        "age": 26,
        "rating": 6.004
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
        "rating": 5.801
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
        "rating": 5.716
      },
      {
        "rank": 15,
        "name": "Mary Brascia",
        "age": 26,
        "rating": 5.684
      },
      {
        "rank": 16,
        "name": "Rika Fujiwara",
        "age": 44,
        "rating": 5.684
      },
      {
        "rank": 17,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.678
      },
      {
        "rank": 18,
        "name": "Chao Yi Wang",
        "age": 24,
        "rating": 5.664
      },
      {
        "rank": 19,
        "name": "Trang Huynh",
        "age": 32,
        "rating": 5.66
      },
      {
        "rank": 20,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 5.64
      },
      {
        "rank": 21,
        "name": "Isabella Dunlap",
        "age": 26,
        "rating": 5.636
      },
      {
        "rank": 22,
        "name": "Kao Pei Chuan",
        "age": 31,
        "rating": 5.635
      },
      {
        "rank": 23,
        "name": "Jorja Johnson",
        "age": 19,
        "rating": 5.62
      },
      {
        "rank": 24,
        "name": "Andie Dikosavljevic",
        "age": 30,
        "rating": 5.611
      },
      {
        "rank": 25,
        "name": "Bobbi Oshiro",
        "age": 32,
        "rating": 5.603
      }
    ]
  },
  "junior": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.237
      },
      {
        "rank": 2,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.12
      },
      {
        "rank": 3,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.073
      },
      {
        "rank": 4,
        "name": "Will Mackinnon",
        "age": 18,
        "rating": 6.012
      },
      {
        "rank": 5,
        "name": "Tristan Dussault",
        "age": 17,
        "rating": 6.003
      },
      {
        "rank": 6,
        "name": "Jace Morris",
        "age": 17,
        "rating": 5.812
      },
      {
        "rank": 7,
        "name": "Dale Kim",
        "age": 18,
        "rating": 5.786
      },
      {
        "rank": 8,
        "name": "Karthik Ganesh",
        "age": 18,
        "rating": 5.755
      },
      {
        "rank": 9,
        "name": "Mauro Garcia Sanchez",
        "age": 18,
        "rating": 5.742
      },
      {
        "rank": 10,
        "name": "Mateusz Matysik",
        "age": 18,
        "rating": 5.71
      },
      {
        "rank": 11,
        "name": "Arwid Dahlin",
        "age": 17,
        "rating": 5.677
      },
      {
        "rank": 12,
        "name": "Ben Slive",
        "age": 16,
        "rating": 5.657
      },
      {
        "rank": 13,
        "name": "Jace Howard",
        "age": 18,
        "rating": 5.651
      },
      {
        "rank": 14,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.648
      },
      {
        "rank": 15,
        "name": "Parth Mody",
        "age": 17,
        "rating": 5.629
      },
      {
        "rank": 16,
        "name": "Ethan Bakalinsky",
        "age": 15,
        "rating": 5.622
      },
      {
        "rank": 17,
        "name": "Indy Dagnall",
        "age": 16,
        "rating": 5.612
      },
      {
        "rank": 18,
        "name": "George Rangelov",
        "age": 18,
        "rating": 5.606
      },
      {
        "rank": 19,
        "name": "Braden Jacobson",
        "age": 16,
        "rating": 5.605
      },
      {
        "rank": 20,
        "name": "Andre Mercado",
        "age": 16,
        "rating": 5.595
      },
      {
        "rank": 21,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.581
      },
      {
        "rank": 22,
        "name": "Jaxon Madsen",
        "age": 18,
        "rating": 5.542
      },
      {
        "rank": 23,
        "name": "Andrew Caldarella",
        "age": 16,
        "rating": 5.54
      },
      {
        "rank": 24,
        "name": "Jayce Landheer",
        "age": 17,
        "rating": 5.538
      },
      {
        "rank": 25,
        "name": "Francis Chi",
        "age": 14,
        "rating": 5.536
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.715
      },
      {
        "rank": 2,
        "name": "Ella Yeh",
        "age": 16,
        "rating": 5.59
      },
      {
        "rank": 3,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.561
      },
      {
        "rank": 4,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 5.481
      },
      {
        "rank": 5,
        "name": "Aline Morales",
        "age": 15,
        "rating": 5.462
      },
      {
        "rank": 6,
        "name": "Averry Chew",
        "age": 17,
        "rating": 5.459
      },
      {
        "rank": 7,
        "name": "Emma Nelson",
        "age": 15,
        "rating": 5.439
      },
      {
        "rank": 8,
        "name": "Jalina Ingram",
        "age": 18,
        "rating": 5.425
      },
      {
        "rank": 9,
        "name": "Adalynn Lund",
        "age": 16,
        "rating": 5.359
      },
      {
        "rank": 10,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 5.347
      },
      {
        "rank": 11,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 5.335
      },
      {
        "rank": 12,
        "name": "Kei Sawaki",
        "age": 15,
        "rating": 5.327
      },
      {
        "rank": 13,
        "name": "Jaeda Minniefield",
        "age": 16,
        "rating": 5.307
      },
      {
        "rank": 14,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 5.253
      },
      {
        "rank": 15,
        "name": "Mary McGowan",
        "age": 17,
        "rating": 5.228
      },
      {
        "rank": 16,
        "name": "Ariana Ajani",
        "age": 15,
        "rating": 5.224
      },
      {
        "rank": 17,
        "name": "Mary Monson",
        "age": 17,
        "rating": 5.175
      },
      {
        "rank": 18,
        "name": "Kayla Williams",
        "age": 16,
        "rating": 5.154
      },
      {
        "rank": 19,
        "name": "CC Eleven Sacca",
        "age": 14,
        "rating": 5.15
      },
      {
        "rank": 20,
        "name": "Jade Rau",
        "age": 16,
        "rating": 5.125
      },
      {
        "rank": 21,
        "name": "E Elenga",
        "age": 17,
        "rating": 5.103
      },
      {
        "rank": 22,
        "name": "Victoria A Simon",
        "age": 16,
        "rating": 5.101
      },
      {
        "rank": 23,
        "name": "Victoria Nguyen",
        "age": 17,
        "rating": 5.084
      },
      {
        "rank": 24,
        "name": "Emily Cho",
        "age": 16,
        "rating": 5.081
      },
      {
        "rank": 25,
        "name": "Naomi Amalsadiwala",
        "age": 16,
        "rating": 5.064
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
        "rating": 6.24
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
        "rating": 5.928
      },
      {
        "rank": 5,
        "name": "Tristan Dussault",
        "age": 17,
        "rating": 5.901
      },
      {
        "rank": 6,
        "name": "Dale Kim",
        "age": 18,
        "rating": 5.892
      },
      {
        "rank": 7,
        "name": "Jaxon Madsen",
        "age": 18,
        "rating": 5.816
      },
      {
        "rank": 8,
        "name": "Indy Dagnall",
        "age": 16,
        "rating": 5.658
      },
      {
        "rank": 9,
        "name": "Jace Morris",
        "age": 17,
        "rating": 5.648
      },
      {
        "rank": 10,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.555
      },
      {
        "rank": 11,
        "name": "Mauro Garcia Sanchez",
        "age": 18,
        "rating": 5.553
      },
      {
        "rank": 12,
        "name": "Andrew Caldarella",
        "age": 16,
        "rating": 5.538
      },
      {
        "rank": 13,
        "name": "Karthik Ganesh",
        "age": 18,
        "rating": 5.514
      },
      {
        "rank": 14,
        "name": "Mateusz Matysik",
        "age": 18,
        "rating": 5.502
      },
      {
        "rank": 15,
        "name": "Parth Mody",
        "age": 17,
        "rating": 5.45
      },
      {
        "rank": 16,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.446
      },
      {
        "rank": 17,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.44
      },
      {
        "rank": 18,
        "name": "Ben Herrick",
        "age": 17,
        "rating": 5.434
      },
      {
        "rank": 19,
        "name": "Braden Jacobson",
        "age": 16,
        "rating": 5.411
      },
      {
        "rank": 20,
        "name": "Ben Slive",
        "age": 16,
        "rating": 5.41
      },
      {
        "rank": 21,
        "name": "Dylan Lewis",
        "age": 18,
        "rating": 5.405
      },
      {
        "rank": 22,
        "name": "heyonglin",
        "age": 16,
        "rating": 5.404
      },
      {
        "rank": 23,
        "name": "Wil Shaffer",
        "age": 17,
        "rating": 5.383
      },
      {
        "rank": 24,
        "name": "Lucas Riffe",
        "age": 16,
        "rating": 5.374
      },
      {
        "rank": 25,
        "name": "Arwid Dahlin",
        "age": 17,
        "rating": 5.324
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.801
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.678
      },
      {
        "rank": 3,
        "name": "Jalina Ingram",
        "age": 18,
        "rating": 5.316
      },
      {
        "rank": 4,
        "name": "Averry Chew",
        "age": 17,
        "rating": 5.199
      },
      {
        "rank": 5,
        "name": "Kei Sawaki",
        "age": 15,
        "rating": 5.149
      },
      {
        "rank": 6,
        "name": "Emma Nelson",
        "age": 15,
        "rating": 5.128
      },
      {
        "rank": 7,
        "name": "Huong Dan Linh",
        "age": 14,
        "rating": 5.069
      },
      {
        "rank": 8,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 4.93
      },
      {
        "rank": 9,
        "name": "Lauren Gosling",
        "age": 15,
        "rating": 4.927
      },
      {
        "rank": 10,
        "name": "Sophia Tran Phuong Anh",
        "age": 18,
        "rating": 4.887
      },
      {
        "rank": 11,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 4.861
      },
      {
        "rank": 12,
        "name": "Kayla Williams",
        "age": 16,
        "rating": 4.841
      },
      {
        "rank": 13,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 4.84
      },
      {
        "rank": 14,
        "name": "Jade Rau",
        "age": 16,
        "rating": 4.821
      },
      {
        "rank": 15,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 4.785
      },
      {
        "rank": 16,
        "name": "Isadora Campi",
        "age": 18,
        "rating": 4.772
      },
      {
        "rank": 17,
        "name": "Lynn Lim",
        "age": 16,
        "rating": 4.734
      },
      {
        "rank": 18,
        "name": "Caroline Maguire",
        "age": 14,
        "rating": 4.727
      },
      {
        "rank": 19,
        "name": "Aria Henare",
        "age": 16,
        "rating": 4.646
      },
      {
        "rank": 20,
        "name": "Melody Li",
        "age": 12,
        "rating": 4.646
      },
      {
        "rank": 21,
        "name": "Abigail OKelley",
        "age": 18,
        "rating": 4.635
      },
      {
        "rank": 22,
        "name": "Jing Robinson",
        "age": 14,
        "rating": 4.617
      },
      {
        "rank": 23,
        "name": "Stevie Petropouleas",
        "age": 15,
        "rating": 4.597
      },
      {
        "rank": 24,
        "name": "Ella Cosma",
        "age": 17,
        "rating": 4.574
      },
      {
        "rank": 25,
        "name": "Victoria A Simon",
        "age": 16,
        "rating": 4.563
      }
    ]
  },
  "asia": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 6.327
      },
      {
        "rank": 2,
        "name": "Yuta Funemizu",
        "age": null,
        "rating": 6.253
      },
      {
        "rank": 3,
        "name": "Jonathan Truong",
        "age": null,
        "rating": 6.252
      },
      {
        "rank": 4,
        "name": "Quang Duong",
        "age": null,
        "rating": 6.205
      },
      {
        "rank": 5,
        "name": "Len Yang",
        "age": null,
        "rating": 6.136
      },
      {
        "rank": 6,
        "name": "Thomas Yu",
        "age": null,
        "rating": 6.03
      },
      {
        "rank": 7,
        "name": "Quan Do",
        "age": null,
        "rating": 5.974
      },
      {
        "rank": 8,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.947
      },
      {
        "rank": 9,
        "name": "Kailas Shekar",
        "age": null,
        "rating": 5.941
      },
      {
        "rank": 10,
        "name": "Harsh Mehta",
        "age": null,
        "rating": 5.921
      },
      {
        "rank": 11,
        "name": "Sanil Jagtiani",
        "age": null,
        "rating": 5.912
      },
      {
        "rank": 12,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.908
      },
      {
        "rank": 13,
        "name": "Eric Roddy",
        "age": null,
        "rating": 5.905
      },
      {
        "rank": 14,
        "name": "Eunggwon Kim",
        "age": null,
        "rating": 5.905
      },
      {
        "rank": 15,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.887
      },
      {
        "rank": 16,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.841
      },
      {
        "rank": 17,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.84
      },
      {
        "rank": 18,
        "name": "Truong Hien",
        "age": null,
        "rating": 5.807
      },
      {
        "rank": 19,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 5.786
      },
      {
        "rank": 20,
        "name": "Arnav Duarah",
        "age": null,
        "rating": 5.753
      },
      {
        "rank": 21,
        "name": "James Yu",
        "age": null,
        "rating": 5.747
      },
      {
        "rank": 22,
        "name": "Rougel Aninon",
        "age": null,
        "rating": 5.745
      },
      {
        "rank": 23,
        "name": "Kenneth Lee",
        "age": null,
        "rating": 5.721
      },
      {
        "rank": 24,
        "name": "Yuvraj Ruia",
        "age": null,
        "rating": 5.72
      },
      {
        "rank": 25,
        "name": "Arjun Singh",
        "age": null,
        "rating": 5.716
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.844
      },
      {
        "rank": 2,
        "name": "Aibika Kalsarieva",
        "age": null,
        "rating": 5.834
      },
      {
        "rank": 3,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.823
      },
      {
        "rank": 4,
        "name": "Alix Truong",
        "age": null,
        "rating": 5.782
      },
      {
        "rank": 5,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.75
      },
      {
        "rank": 6,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.66
      },
      {
        "rank": 7,
        "name": "Marisa Ruiz",
        "age": null,
        "rating": 5.645
      },
      {
        "rank": 8,
        "name": "Kara Wheatley",
        "age": null,
        "rating": 5.63
      },
      {
        "rank": 9,
        "name": "Nicole Eugenio",
        "age": null,
        "rating": 5.569
      },
      {
        "rank": 10,
        "name": "Natalie Hur",
        "age": null,
        "rating": 5.507
      },
      {
        "rank": 11,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.499
      },
      {
        "rank": 12,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.467
      },
      {
        "rank": 13,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.466
      },
      {
        "rank": 14,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.449
      },
      {
        "rank": 15,
        "name": "Xiao Yi Wang Beckvall",
        "age": null,
        "rating": 5.419
      },
      {
        "rank": 16,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.395
      },
      {
        "rank": 17,
        "name": "Kai Fen Yi",
        "age": null,
        "rating": 5.387
      },
      {
        "rank": 18,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.38
      },
      {
        "rank": 19,
        "name": "Lyn Yuen Choo",
        "age": null,
        "rating": 5.379
      },
      {
        "rank": 20,
        "name": "Vritti Sethi",
        "age": null,
        "rating": 5.375
      },
      {
        "rank": 21,
        "name": "Kei Sawaki",
        "age": null,
        "rating": 5.372
      },
      {
        "rank": 22,
        "name": "Naimi Mehta",
        "age": null,
        "rating": 5.344
      },
      {
        "rank": 23,
        "name": "Pearl Amalsadiwala",
        "age": null,
        "rating": 5.332
      },
      {
        "rank": 24,
        "name": "Dionne Lim",
        "age": null,
        "rating": 5.326
      },
      {
        "rank": 25,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.316
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
        "rating": 6.151
      },
      {
        "rank": 3,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 6.088
      },
      {
        "rank": 4,
        "name": "Truong Hien",
        "age": null,
        "rating": 6.081
      },
      {
        "rank": 5,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 5.942
      },
      {
        "rank": 6,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.936
      },
      {
        "rank": 7,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.892
      },
      {
        "rank": 8,
        "name": "Kenneth Lee",
        "age": null,
        "rating": 5.844
      },
      {
        "rank": 9,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.783
      },
      {
        "rank": 10,
        "name": "Nasa Hatakeyama",
        "age": null,
        "rating": 5.762
      },
      {
        "rank": 11,
        "name": "Thomas Yu",
        "age": null,
        "rating": 5.726
      },
      {
        "rank": 12,
        "name": "Jimmy Liong Kai Long",
        "age": null,
        "rating": 5.706
      },
      {
        "rank": 13,
        "name": "Kento Tamaki",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 14,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.591
      },
      {
        "rank": 15,
        "name": "Heyonglin",
        "age": null,
        "rating": 5.557
      },
      {
        "rank": 16,
        "name": "Vanshik Kapadia",
        "age": null,
        "rating": 5.533
      },
      {
        "rank": 17,
        "name": "Aditya Ruhela",
        "age": null,
        "rating": 5.484
      },
      {
        "rank": 18,
        "name": "Hoai Anh Pham",
        "age": null,
        "rating": 5.447
      },
      {
        "rank": 19,
        "name": "Diwakar Agarwal",
        "age": null,
        "rating": 5.435
      },
      {
        "rank": 20,
        "name": "Marco Leung",
        "age": null,
        "rating": 5.413
      },
      {
        "rank": 21,
        "name": "Rashein Samuel",
        "age": null,
        "rating": 5.401
      },
      {
        "rank": 22,
        "name": "Arik Badami",
        "age": null,
        "rating": 5.4
      },
      {
        "rank": 23,
        "name": "Rahul Belwal",
        "age": null,
        "rating": 5.378
      },
      {
        "rank": 24,
        "name": "Ruben A Gonzales Jr",
        "age": null,
        "rating": 5.374
      },
      {
        "rank": 25,
        "name": "Arjun Singh",
        "age": null,
        "rating": 5.374
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.684
      },
      {
        "rank": 2,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.664
      },
      {
        "rank": 3,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.637
      },
      {
        "rank": 4,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.62
      },
      {
        "rank": 5,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.599
      },
      {
        "rank": 6,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.579
      },
      {
        "rank": 7,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.396
      },
      {
        "rank": 8,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.35
      },
      {
        "rank": 9,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.303
      },
      {
        "rank": 10,
        "name": "Aaliya Ebrahim",
        "age": null,
        "rating": 5.286
      },
      {
        "rank": 11,
        "name": "Mihika Yadav",
        "age": null,
        "rating": 5.264
      },
      {
        "rank": 12,
        "name": "Kei Sawaki",
        "age": null,
        "rating": 5.255
      },
      {
        "rank": 13,
        "name": "Albie Huang",
        "age": null,
        "rating": 5.205
      },
      {
        "rank": 14,
        "name": "Anna Clarice Patrimonio",
        "age": null,
        "rating": 5.177
      },
      {
        "rank": 15,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.124
      },
      {
        "rank": 16,
        "name": "Ken Tam",
        "age": null,
        "rating": 5.097
      },
      {
        "rank": 17,
        "name": "Huong Dan Linh",
        "age": null,
        "rating": 5.097
      },
      {
        "rank": 18,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.081
      },
      {
        "rank": 19,
        "name": "Ying Suet Lam",
        "age": null,
        "rating": 5.062
      },
      {
        "rank": 20,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.058
      },
      {
        "rank": 21,
        "name": "Yunqi He",
        "age": null,
        "rating": 5.046
      },
      {
        "rank": 22,
        "name": "Anni Xie",
        "age": null,
        "rating": 5.045
      },
      {
        "rank": 23,
        "name": "Duru Bekaroglu",
        "age": null,
        "rating": 5.043
      },
      {
        "rank": 24,
        "name": "Lo Pay Jyue",
        "age": null,
        "rating": 5.036
      },
      {
        "rank": 25,
        "name": "Christy Sañosa",
        "age": null,
        "rating": 4.978
      }
    ]
  },
  "north-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Ben Johns",
        "age": null,
        "rating": 7.122
      },
      {
        "rank": 2,
        "name": "Jw Johnson",
        "age": null,
        "rating": 7.055
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": null,
        "rating": 6.932
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.911
      },
      {
        "rank": 5,
        "name": "Riley Newman",
        "age": null,
        "rating": 6.632
      },
      {
        "rank": 6,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.59
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
        "rating": 6.526
      },
      {
        "rank": 9,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.463
      },
      {
        "rank": 10,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.451
      },
      {
        "rank": 11,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.439
      },
      {
        "rank": 12,
        "name": "Augustus Ge",
        "age": null,
        "rating": 6.394
      },
      {
        "rank": 13,
        "name": "Jack Munro",
        "age": null,
        "rating": 6.331
      },
      {
        "rank": 14,
        "name": "Matt Wright",
        "age": null,
        "rating": 6.318
      },
      {
        "rank": 15,
        "name": "John Goins",
        "age": null,
        "rating": 6.315
      },
      {
        "rank": 16,
        "name": "Maxwell Freeman",
        "age": null,
        "rating": 6.306
      },
      {
        "rank": 17,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.297
      },
      {
        "rank": 18,
        "name": "Tyson Mcguffin",
        "age": null,
        "rating": 6.295
      },
      {
        "rank": 19,
        "name": "Blaine Hovenier",
        "age": null,
        "rating": 6.274
      },
      {
        "rank": 20,
        "name": "Richard Livornese Jr",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 21,
        "name": "Zane Navratil",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 22,
        "name": "Max Manthou",
        "age": null,
        "rating": 6.261
      },
      {
        "rank": 23,
        "name": "Travis Rettenmaier",
        "age": null,
        "rating": 6.26
      },
      {
        "rank": 24,
        "name": "Casey Diamond",
        "age": null,
        "rating": 6.25
      },
      {
        "rank": 25,
        "name": "Aj Koller",
        "age": null,
        "rating": 6.25
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.995
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": null,
        "rating": 6.607
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": null,
        "rating": 6.35
      },
      {
        "rank": 4,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 6.324
      },
      {
        "rank": 5,
        "name": "Parris Todd",
        "age": null,
        "rating": 6.286
      },
      {
        "rank": 6,
        "name": "Rachel Rohrabacher",
        "age": null,
        "rating": 6.254
      },
      {
        "rank": 7,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.236
      },
      {
        "rank": 8,
        "name": "Jade Kawamoto",
        "age": null,
        "rating": 6.169
      },
      {
        "rank": 9,
        "name": "Jackie Kawamoto",
        "age": null,
        "rating": 6.13
      },
      {
        "rank": 10,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.124
      },
      {
        "rank": 11,
        "name": "Mariechristine Salvas",
        "age": null,
        "rating": 6.121
      },
      {
        "rank": 12,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 6.109
      },
      {
        "rank": 13,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 6.101
      },
      {
        "rank": 14,
        "name": "Jillian Braverman",
        "age": null,
        "rating": 6.012
      },
      {
        "rank": 15,
        "name": "Lacy Schneemann",
        "age": null,
        "rating": 5.974
      },
      {
        "rank": 16,
        "name": "Etta Tuionetoa",
        "age": null,
        "rating": 5.967
      },
      {
        "rank": 17,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.965
      },
      {
        "rank": 18,
        "name": "Meghan Dizon",
        "age": null,
        "rating": 5.959
      },
      {
        "rank": 19,
        "name": "Vivian Glozman",
        "age": null,
        "rating": 5.928
      },
      {
        "rank": 20,
        "name": "Audra Spielberger",
        "age": null,
        "rating": 5.904
      },
      {
        "rank": 21,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.882
      },
      {
        "rank": 22,
        "name": "Lauren Cole",
        "age": null,
        "rating": 5.844
      },
      {
        "rank": 23,
        "name": "Allison Harris",
        "age": null,
        "rating": 5.837
      },
      {
        "rank": 24,
        "name": "Angela Simon",
        "age": null,
        "rating": 5.831
      },
      {
        "rank": 25,
        "name": "Allyce Jones",
        "age": null,
        "rating": 5.825
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
        "name": "Jack Sock",
        "age": null,
        "rating": 6.533
      },
      {
        "rank": 5,
        "name": "John Goins",
        "age": null,
        "rating": 6.518
      },
      {
        "rank": 6,
        "name": "Ammar Wazir",
        "age": null,
        "rating": 6.487
      },
      {
        "rank": 7,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.486
      },
      {
        "rank": 8,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.448
      },
      {
        "rank": 9,
        "name": "Zane Ford",
        "age": null,
        "rating": 6.431
      },
      {
        "rank": 10,
        "name": "Jw Johnson",
        "age": null,
        "rating": 6.31
      },
      {
        "rank": 11,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.269
      },
      {
        "rank": 12,
        "name": "Adam Harvey",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 13,
        "name": "Gabriel Joseph",
        "age": null,
        "rating": 6.257
      },
      {
        "rank": 14,
        "name": "Dusty Boyer",
        "age": null,
        "rating": 6.251
      },
      {
        "rank": 15,
        "name": "Ronan Camron",
        "age": null,
        "rating": 6.242
      },
      {
        "rank": 16,
        "name": "Tama Shimabukuro",
        "age": null,
        "rating": 6.24
      },
      {
        "rank": 17,
        "name": "Donald Young",
        "age": null,
        "rating": 6.237
      },
      {
        "rank": 18,
        "name": "Yates Johnson",
        "age": null,
        "rating": 6.218
      },
      {
        "rank": 19,
        "name": "Camden Chaffin",
        "age": null,
        "rating": 6.217
      },
      {
        "rank": 20,
        "name": "Brandon French",
        "age": null,
        "rating": 6.127
      },
      {
        "rank": 21,
        "name": "Rafa Hewett",
        "age": null,
        "rating": 6.127
      },
      {
        "rank": 22,
        "name": "Alexander Crum",
        "age": null,
        "rating": 6.121
      },
      {
        "rank": 23,
        "name": "Connor Mogle",
        "age": null,
        "rating": 6.115
      },
      {
        "rank": 24,
        "name": "Cason Campbell",
        "age": null,
        "rating": 6.112
      },
      {
        "rank": 25,
        "name": "Matthew Barlow",
        "age": null,
        "rating": 6.087
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
        "name": "Katerina Stewart",
        "age": null,
        "rating": 6.053
      },
      {
        "rank": 4,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.004
      },
      {
        "rank": 5,
        "name": "Lea Jansen",
        "age": null,
        "rating": 5.882
      },
      {
        "rank": 6,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.874
      },
      {
        "rank": 7,
        "name": "Kaitlyn Christian",
        "age": null,
        "rating": 5.864
      },
      {
        "rank": 8,
        "name": "Kiora Kunimoto",
        "age": null,
        "rating": 5.801
      },
      {
        "rank": 9,
        "name": "Genie Bouchard",
        "age": null,
        "rating": 5.769
      },
      {
        "rank": 10,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 5.759
      },
      {
        "rank": 11,
        "name": "Mary Brascia",
        "age": null,
        "rating": 5.684
      },
      {
        "rank": 12,
        "name": "Cailyn Campbell",
        "age": null,
        "rating": 5.678
      },
      {
        "rank": 13,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.645
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
        "name": "Victoria Dimuzio",
        "age": null,
        "rating": 5.548
      },
      {
        "rank": 17,
        "name": "Amber Policare",
        "age": null,
        "rating": 5.539
      },
      {
        "rank": 18,
        "name": "Jada Bui",
        "age": null,
        "rating": 5.481
      },
      {
        "rank": 19,
        "name": "Shannon Pretorius",
        "age": null,
        "rating": 5.478
      },
      {
        "rank": 20,
        "name": "Eileen Wang",
        "age": null,
        "rating": 5.472
      },
      {
        "rank": 21,
        "name": "Liz Truluck",
        "age": null,
        "rating": 5.453
      },
      {
        "rank": 22,
        "name": "Karin Ptaszek-Kochis",
        "age": null,
        "rating": 5.437
      },
      {
        "rank": 23,
        "name": "Milan Rane",
        "age": null,
        "rating": 5.435
      },
      {
        "rank": 24,
        "name": "Jessica Ho",
        "age": null,
        "rating": 5.43
      },
      {
        "rank": 25,
        "name": "Zoey Weil",
        "age": null,
        "rating": 5.405
      }
    ]
  },
  "south-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Gabriel Tardio",
        "age": null,
        "rating": 6.913
      },
      {
        "rank": 2,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.709
      },
      {
        "rank": 3,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.684
      },
      {
        "rank": 4,
        "name": "Nicolas Acevedo",
        "age": null,
        "rating": 6.56
      },
      {
        "rank": 5,
        "name": "Pablo Tellez",
        "age": null,
        "rating": 6.376
      },
      {
        "rank": 6,
        "name": "Bruno Faletto",
        "age": null,
        "rating": 6.142
      },
      {
        "rank": 7,
        "name": "Jaime Oncins",
        "age": null,
        "rating": 6.101
      },
      {
        "rank": 8,
        "name": "Juan Benitez",
        "age": null,
        "rating": 6.056
      },
      {
        "rank": 9,
        "name": "James Delgado",
        "age": null,
        "rating": 6.05
      },
      {
        "rank": 10,
        "name": "Andre Millet",
        "age": null,
        "rating": 5.995
      },
      {
        "rank": 11,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 5.971
      },
      {
        "rank": 12,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.96
      },
      {
        "rank": 13,
        "name": "Mario Barrientos",
        "age": null,
        "rating": 5.831
      },
      {
        "rank": 14,
        "name": "Carlos Di Laura",
        "age": null,
        "rating": 5.781
      },
      {
        "rank": 15,
        "name": "Patricio Pereyra",
        "age": null,
        "rating": 5.749
      },
      {
        "rank": 16,
        "name": "Caio Bardauil",
        "age": null,
        "rating": 5.692
      },
      {
        "rank": 17,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.594
      },
      {
        "rank": 18,
        "name": "Miguel Alda",
        "age": null,
        "rating": 5.575
      },
      {
        "rank": 19,
        "name": "Tobias Golberg",
        "age": null,
        "rating": 5.574
      },
      {
        "rank": 20,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.48
      },
      {
        "rank": 21,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.459
      },
      {
        "rank": 22,
        "name": "Alex Simon",
        "age": null,
        "rating": 5.443
      },
      {
        "rank": 23,
        "name": "Carlos Subero",
        "age": null,
        "rating": 5.442
      },
      {
        "rank": 24,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 5.44
      },
      {
        "rank": 25,
        "name": "Juan Medina",
        "age": null,
        "rating": 5.43
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 6.016
      },
      {
        "rank": 2,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 6.002
      },
      {
        "rank": 3,
        "name": "Lucia White",
        "age": null,
        "rating": 5.656
      },
      {
        "rank": 4,
        "name": "Pierina Imparato",
        "age": null,
        "rating": 5.508
      },
      {
        "rank": 5,
        "name": "Alexa Quintanilla",
        "age": null,
        "rating": 5.418
      },
      {
        "rank": 6,
        "name": "Gabriela Katz",
        "age": null,
        "rating": 5.404
      },
      {
        "rank": 7,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 5.307
      },
      {
        "rank": 8,
        "name": "Florencia Rossi Luque",
        "age": null,
        "rating": 5.24
      },
      {
        "rank": 9,
        "name": "Namie Isago",
        "age": null,
        "rating": 5.229
      },
      {
        "rank": 10,
        "name": "Nicole Lange Beidacki",
        "age": null,
        "rating": 5.161
      },
      {
        "rank": 11,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.123
      },
      {
        "rank": 12,
        "name": "Bequi Barros Behar Luizelli",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 13,
        "name": "Tatiana Ruhl",
        "age": null,
        "rating": 5.011
      },
      {
        "rank": 14,
        "name": "Dayana Fahey",
        "age": null,
        "rating": 4.989
      },
      {
        "rank": 15,
        "name": "Ali Quintero",
        "age": null,
        "rating": 4.981
      },
      {
        "rank": 16,
        "name": "Barbara Lopez",
        "age": null,
        "rating": 4.958
      },
      {
        "rank": 17,
        "name": "Patricia Medrado",
        "age": null,
        "rating": 4.925
      },
      {
        "rank": 18,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.888
      },
      {
        "rank": 19,
        "name": "Arianna Raga",
        "age": null,
        "rating": 4.883
      },
      {
        "rank": 20,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.881
      },
      {
        "rank": 21,
        "name": "Mariana Jimenez",
        "age": null,
        "rating": 4.818
      },
      {
        "rank": 22,
        "name": "Eliza  De Oliveira Rocha",
        "age": null,
        "rating": 4.816
      },
      {
        "rank": 23,
        "name": "Mariana Paredes",
        "age": null,
        "rating": 4.745
      },
      {
        "rank": 24,
        "name": "Katie Neils",
        "age": null,
        "rating": 4.686
      },
      {
        "rank": 25,
        "name": "Fernanda Themudo",
        "age": null,
        "rating": 4.679
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
        "name": "Andre Millet",
        "age": null,
        "rating": 6.069
      },
      {
        "rank": 5,
        "name": "Juan Benitez",
        "age": null,
        "rating": 5.857
      },
      {
        "rank": 6,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.688
      },
      {
        "rank": 7,
        "name": "Nicolas Almeida",
        "age": null,
        "rating": 5.467
      },
      {
        "rank": 8,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.444
      },
      {
        "rank": 9,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.402
      },
      {
        "rank": 10,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.348
      },
      {
        "rank": 11,
        "name": "Ayke Rodrigues",
        "age": null,
        "rating": 5.267
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
        "rating": 5.24
      },
      {
        "rank": 14,
        "name": "Juan Pablo Pinilla",
        "age": null,
        "rating": 5.232
      },
      {
        "rank": 15,
        "name": "Caio Silva",
        "age": null,
        "rating": 5.194
      },
      {
        "rank": 16,
        "name": "Lucas Severo",
        "age": null,
        "rating": 5.163
      },
      {
        "rank": 17,
        "name": "Thiago Soto",
        "age": null,
        "rating": 5.143
      },
      {
        "rank": 18,
        "name": "João Pedro  Agulha Fernandes",
        "age": null,
        "rating": 5.138
      },
      {
        "rank": 19,
        "name": "Nicolas Yannuzzi",
        "age": null,
        "rating": 5.119
      },
      {
        "rank": 20,
        "name": "Bruno Semino",
        "age": null,
        "rating": 5.087
      },
      {
        "rank": 21,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 5.085
      },
      {
        "rank": 22,
        "name": "Bernardo Valdes",
        "age": null,
        "rating": 5.068
      },
      {
        "rank": 23,
        "name": "Tony Ottamendi",
        "age": null,
        "rating": 5.028
      },
      {
        "rank": 24,
        "name": "Rodrigo  Borrero",
        "age": null,
        "rating": 5.017
      },
      {
        "rank": 25,
        "name": "Eduardo Correia",
        "age": null,
        "rating": 4.974
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 5.289
      },
      {
        "rank": 2,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 5.273
      },
      {
        "rank": 3,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.892
      },
      {
        "rank": 4,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 4.89
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
        "name": "Sofia Kelbert",
        "age": null,
        "rating": 4.581
      },
      {
        "rank": 9,
        "name": "Ana Sánchez",
        "age": null,
        "rating": 4.541
      },
      {
        "rank": 10,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.402
      },
      {
        "rank": 11,
        "name": "Delfina Debenedetti",
        "age": null,
        "rating": 4.336
      },
      {
        "rank": 12,
        "name": "Carolina Ledesma",
        "age": null,
        "rating": 4.256
      },
      {
        "rank": 13,
        "name": "Javiera Elena Escobar",
        "age": null,
        "rating": 4.219
      },
      {
        "rank": 14,
        "name": "Mariana Negreiros Mariano",
        "age": null,
        "rating": 4.183
      },
      {
        "rank": 15,
        "name": "Cristina Verta",
        "age": null,
        "rating": 4.137
      },
      {
        "rank": 16,
        "name": "Viviane Rentroia",
        "age": null,
        "rating": 4.084
      },
      {
        "rank": 17,
        "name": "Mia Alva",
        "age": null,
        "rating": 4.012
      },
      {
        "rank": 18,
        "name": "Valeria Mayta",
        "age": null,
        "rating": 4.003
      },
      {
        "rank": 19,
        "name": "Alejandra Báez",
        "age": null,
        "rating": 3.957
      },
      {
        "rank": 20,
        "name": "Roberta Seidl",
        "age": null,
        "rating": 3.923
      },
      {
        "rank": 21,
        "name": "Ana Paula Bergmann",
        "age": null,
        "rating": 3.923
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
        "rating": 3.692
      }
    ]
  },
  "australia-oceania": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "George Wall",
        "age": null,
        "rating": 6.036
      },
      {
        "rank": 2,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 6.021
      },
      {
        "rank": 3,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.889
      },
      {
        "rank": 4,
        "name": "Andre Mick",
        "age": null,
        "rating": 5.796
      },
      {
        "rank": 5,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.736
      },
      {
        "rank": 6,
        "name": "Robert Claveria Stirling",
        "age": null,
        "rating": 5.727
      },
      {
        "rank": 7,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.723
      },
      {
        "rank": 8,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.663
      },
      {
        "rank": 9,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.611
      },
      {
        "rank": 10,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.553
      },
      {
        "rank": 11,
        "name": "Morgan Evans",
        "age": null,
        "rating": 5.535
      },
      {
        "rank": 12,
        "name": "Brian  Tran",
        "age": null,
        "rating": 5.506
      },
      {
        "rank": 13,
        "name": "Ciaran Lavers",
        "age": null,
        "rating": 5.354
      },
      {
        "rank": 14,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.346
      },
      {
        "rank": 15,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.346
      },
      {
        "rank": 16,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 5.318
      },
      {
        "rank": 17,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.318
      },
      {
        "rank": 18,
        "name": "Andrew Kratzmann",
        "age": null,
        "rating": 5.316
      },
      {
        "rank": 19,
        "name": "Will Dewhirst",
        "age": null,
        "rating": 5.309
      },
      {
        "rank": 20,
        "name": "Ryan Morris",
        "age": null,
        "rating": 5.279
      },
      {
        "rank": 21,
        "name": "Ethan Butson",
        "age": null,
        "rating": 5.275
      },
      {
        "rank": 22,
        "name": "Joshua Nipperess",
        "age": null,
        "rating": 5.274
      },
      {
        "rank": 23,
        "name": "Chris Turvey",
        "age": null,
        "rating": 5.259
      },
      {
        "rank": 24,
        "name": "Martin Clark",
        "age": null,
        "rating": 5.259
      },
      {
        "rank": 25,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.246
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 6.068
      },
      {
        "rank": 2,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.911
      },
      {
        "rank": 3,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.823
      },
      {
        "rank": 4,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.74
      },
      {
        "rank": 5,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.73
      },
      {
        "rank": 6,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.714
      },
      {
        "rank": 7,
        "name": "Kelsey Grambeau",
        "age": null,
        "rating": 5.709
      },
      {
        "rank": 8,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.57
      },
      {
        "rank": 9,
        "name": "Talia Saunders",
        "age": null,
        "rating": 5.491
      },
      {
        "rank": 10,
        "name": "Sarah Burr",
        "age": null,
        "rating": 5.392
      },
      {
        "rank": 11,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 5.377
      },
      {
        "rank": 12,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 5.307
      },
      {
        "rank": 13,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.279
      },
      {
        "rank": 14,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.276
      },
      {
        "rank": 15,
        "name": "Brittany Yang",
        "age": null,
        "rating": 5.201
      },
      {
        "rank": 16,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 5.183
      },
      {
        "rank": 17,
        "name": "Karen Denman",
        "age": null,
        "rating": 5.127
      },
      {
        "rank": 18,
        "name": "Lara Giltinan",
        "age": null,
        "rating": 5.109
      },
      {
        "rank": 19,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.105
      },
      {
        "rank": 20,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 5.101
      },
      {
        "rank": 21,
        "name": "Katerina Valos",
        "age": null,
        "rating": 5.073
      },
      {
        "rank": 22,
        "name": "Tyra Calderwood",
        "age": null,
        "rating": 5.031
      },
      {
        "rank": 23,
        "name": "Rosa Morris",
        "age": null,
        "rating": 5.005
      },
      {
        "rank": 24,
        "name": "Bee Horsley",
        "age": null,
        "rating": 4.996
      },
      {
        "rank": 25,
        "name": "Tayah Cross",
        "age": null,
        "rating": 4.97
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Robbie  Lee",
        "age": null,
        "rating": 5.852
      },
      {
        "rank": 2,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.712
      },
      {
        "rank": 3,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.703
      },
      {
        "rank": 4,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.589
      },
      {
        "rank": 5,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.429
      },
      {
        "rank": 6,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.389
      },
      {
        "rank": 7,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.347
      },
      {
        "rank": 8,
        "name": "Andy Van Der Vyver",
        "age": null,
        "rating": 5.33
      },
      {
        "rank": 9,
        "name": "Brian  Tran",
        "age": null,
        "rating": 5.323
      },
      {
        "rank": 10,
        "name": "Matthew Kouznetsov",
        "age": null,
        "rating": 5.288
      },
      {
        "rank": 11,
        "name": "Henrik Traskin",
        "age": null,
        "rating": 5.264
      },
      {
        "rank": 12,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.2
      },
      {
        "rank": 13,
        "name": "Ethan Chung",
        "age": null,
        "rating": 5.166
      },
      {
        "rank": 14,
        "name": "James Wilson",
        "age": null,
        "rating": 5.156
      },
      {
        "rank": 15,
        "name": "Joshua Barber",
        "age": null,
        "rating": 5.112
      },
      {
        "rank": 16,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.106
      },
      {
        "rank": 17,
        "name": "Nicholas Maleganeas",
        "age": null,
        "rating": 5.093
      },
      {
        "rank": 18,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.092
      },
      {
        "rank": 19,
        "name": "Michael Massih",
        "age": null,
        "rating": 5.079
      },
      {
        "rank": 20,
        "name": "Liam Lamb",
        "age": null,
        "rating": 5.079
      },
      {
        "rank": 21,
        "name": "Nigel Lee",
        "age": null,
        "rating": 5.062
      },
      {
        "rank": 22,
        "name": "Kyron Pinter",
        "age": null,
        "rating": 5.061
      },
      {
        "rank": 23,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 5.056
      },
      {
        "rank": 24,
        "name": "Sam Aslanowicz",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 25,
        "name": "Ethan Butson",
        "age": null,
        "rating": 5.044
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.974
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
        "rating": 5.716
      },
      {
        "rank": 4,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.589
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
        "rating": 5.424
      },
      {
        "rank": 7,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.403
      },
      {
        "rank": 8,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.389
      },
      {
        "rank": 9,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 5.189
      },
      {
        "rank": 10,
        "name": "Jasmine Almaguer",
        "age": null,
        "rating": 5.166
      },
      {
        "rank": 11,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.145
      },
      {
        "rank": 12,
        "name": "Helena Spiridis",
        "age": null,
        "rating": 5.103
      },
      {
        "rank": 13,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 5.073
      },
      {
        "rank": 14,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 15,
        "name": "Katerina Valos",
        "age": null,
        "rating": 5.03
      },
      {
        "rank": 16,
        "name": "Bee Horsley",
        "age": null,
        "rating": 4.998
      },
      {
        "rank": 17,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 4.974
      },
      {
        "rank": 18,
        "name": "Nives Baric",
        "age": null,
        "rating": 4.961
      },
      {
        "rank": 19,
        "name": "Simone Kessell",
        "age": null,
        "rating": 4.948
      },
      {
        "rank": 20,
        "name": "Brittany Yang",
        "age": null,
        "rating": 4.938
      },
      {
        "rank": 21,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 4.926
      },
      {
        "rank": 22,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 4.92
      },
      {
        "rank": 23,
        "name": "Ange Green",
        "age": null,
        "rating": 4.876
      },
      {
        "rank": 24,
        "name": "Karen Denman",
        "age": null,
        "rating": 4.875
      },
      {
        "rank": 25,
        "name": "Rosa Morris",
        "age": null,
        "rating": 4.861
      }
    ]
  },
  "europe": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Andrei Daescu",
        "age": null,
        "rating": 6.879
      },
      {
        "rank": 2,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 6.591
      },
      {
        "rank": 3,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.532
      },
      {
        "rank": 4,
        "name": "Dekel Bar",
        "age": null,
        "rating": 6.466
      },
      {
        "rank": 5,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.333
      },
      {
        "rank": 6,
        "name": "Martin Emmrich",
        "age": null,
        "rating": 6.297
      },
      {
        "rank": 7,
        "name": "Michael Loyd",
        "age": null,
        "rating": 6.274
      },
      {
        "rank": 8,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.227
      },
      {
        "rank": 9,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 6.123
      },
      {
        "rank": 10,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 6.094
      },
      {
        "rank": 11,
        "name": "Dj Young",
        "age": null,
        "rating": 6.082
      },
      {
        "rank": 12,
        "name": "Oscar Serra",
        "age": null,
        "rating": 6.074
      },
      {
        "rank": 13,
        "name": "Tom Protzek",
        "age": null,
        "rating": 6.025
      },
      {
        "rank": 14,
        "name": "Henry Boyle",
        "age": null,
        "rating": 5.944
      },
      {
        "rank": 15,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.935
      },
      {
        "rank": 16,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.898
      },
      {
        "rank": 17,
        "name": "Jaime Lladro",
        "age": null,
        "rating": 5.86
      },
      {
        "rank": 18,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.846
      },
      {
        "rank": 19,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 5.844
      },
      {
        "rank": 20,
        "name": "Patrick Smith",
        "age": null,
        "rating": 5.837
      },
      {
        "rank": 21,
        "name": "Domenico Geminiani",
        "age": null,
        "rating": 5.801
      },
      {
        "rank": 22,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.791
      },
      {
        "rank": 23,
        "name": "Louis Laville",
        "age": null,
        "rating": 5.746
      },
      {
        "rank": 24,
        "name": "Mark Growcott",
        "age": null,
        "rating": 5.746
      },
      {
        "rank": 25,
        "name": "Platel Theo",
        "age": null,
        "rating": 5.732
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Tina Pisnik",
        "age": null,
        "rating": 6.196
      },
      {
        "rank": 2,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 6.069
      },
      {
        "rank": 3,
        "name": "Megan Fudge",
        "age": null,
        "rating": 5.962
      },
      {
        "rank": 4,
        "name": "Ewa Radzikowska",
        "age": null,
        "rating": 5.855
      },
      {
        "rank": 5,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.794
      },
      {
        "rank": 6,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.733
      },
      {
        "rank": 7,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.729
      },
      {
        "rank": 8,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.72
      },
      {
        "rank": 9,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.712
      },
      {
        "rank": 10,
        "name": "Paula Rives Palau",
        "age": null,
        "rating": 5.661
      },
      {
        "rank": 11,
        "name": "Daria Walczak",
        "age": null,
        "rating": 5.655
      },
      {
        "rank": 12,
        "name": "Lucy Kovalova",
        "age": null,
        "rating": 5.65
      },
      {
        "rank": 13,
        "name": "Andrea Olson",
        "age": null,
        "rating": 5.586
      },
      {
        "rank": 14,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.577
      },
      {
        "rank": 15,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.573
      },
      {
        "rank": 16,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.562
      },
      {
        "rank": 17,
        "name": "Martina Frantova",
        "age": null,
        "rating": 5.56
      },
      {
        "rank": 18,
        "name": "Maria Klokotzky",
        "age": null,
        "rating": 5.533
      },
      {
        "rank": 19,
        "name": "Molly Odonoghue",
        "age": null,
        "rating": 5.525
      },
      {
        "rank": 20,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.494
      },
      {
        "rank": 21,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 5.484
      },
      {
        "rank": 22,
        "name": "Glauka Carvajal Lane",
        "age": null,
        "rating": 5.454
      },
      {
        "rank": 23,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.442
      },
      {
        "rank": 24,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.426
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
        "rating": 6.033
      },
      {
        "rank": 6,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 6.023
      },
      {
        "rank": 7,
        "name": "Michael Loyd",
        "age": null,
        "rating": 5.968
      },
      {
        "rank": 8,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.89
      },
      {
        "rank": 9,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 5.881
      },
      {
        "rank": 10,
        "name": "Emilien  Burnel",
        "age": null,
        "rating": 5.875
      },
      {
        "rank": 11,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 5.872
      },
      {
        "rank": 12,
        "name": "Matthew Finnerty",
        "age": null,
        "rating": 5.864
      },
      {
        "rank": 13,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.862
      },
      {
        "rank": 14,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.69
      },
      {
        "rank": 15,
        "name": "Claudio Quinones Garcia",
        "age": null,
        "rating": 5.666
      },
      {
        "rank": 16,
        "name": "Shay Hugo",
        "age": null,
        "rating": 5.661
      },
      {
        "rank": 17,
        "name": "James Chaudry",
        "age": null,
        "rating": 5.649
      },
      {
        "rank": 18,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.642
      },
      {
        "rank": 19,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.613
      },
      {
        "rank": 20,
        "name": "Bartosz Karbownik",
        "age": null,
        "rating": 5.609
      },
      {
        "rank": 21,
        "name": "Mikar Fisher",
        "age": null,
        "rating": 5.606
      },
      {
        "rank": 22,
        "name": "Jasper Schaadt",
        "age": null,
        "rating": 5.601
      },
      {
        "rank": 23,
        "name": "Mikołaj Biedermann",
        "age": null,
        "rating": 5.592
      },
      {
        "rank": 24,
        "name": "Zj Ignash",
        "age": null,
        "rating": 5.592
      },
      {
        "rank": 25,
        "name": "Ignasi De Rueda",
        "age": null,
        "rating": 5.587
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
        "rating": 5.667
      },
      {
        "rank": 3,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.613
      },
      {
        "rank": 4,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 5,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.534
      },
      {
        "rank": 6,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.481
      },
      {
        "rank": 7,
        "name": "Katie Morris",
        "age": null,
        "rating": 5.445
      },
      {
        "rank": 8,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.438
      },
      {
        "rank": 9,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.405
      },
      {
        "rank": 10,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.386
      },
      {
        "rank": 11,
        "name": "Caroline Nothnagel",
        "age": null,
        "rating": 5.344
      },
      {
        "rank": 12,
        "name": "Maria Tatarnikova",
        "age": null,
        "rating": 5.337
      },
      {
        "rank": 13,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.232
      },
      {
        "rank": 14,
        "name": "Francesca  Rumi",
        "age": null,
        "rating": 5.216
      },
      {
        "rank": 15,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.172
      },
      {
        "rank": 16,
        "name": "Maria Fernandez Costantino",
        "age": null,
        "rating": 5.172
      },
      {
        "rank": 17,
        "name": "Alma Thell Lenntorp",
        "age": null,
        "rating": 5.168
      },
      {
        "rank": 18,
        "name": "Pialena Ander",
        "age": null,
        "rating": 5.129
      },
      {
        "rank": 19,
        "name": "Marina Alcaide",
        "age": null,
        "rating": 5.071
      },
      {
        "rank": 20,
        "name": "Naomi De Hart",
        "age": null,
        "rating": 5.045
      },
      {
        "rank": 21,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.03
      },
      {
        "rank": 22,
        "name": "Emilia Richter",
        "age": null,
        "rating": 5.007
      },
      {
        "rank": 23,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 4.995
      },
      {
        "rank": 24,
        "name": "Mollie Knaggs",
        "age": null,
        "rating": 4.95
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

export const DUPR_LAST_UPDATED = "2026-08-31";
