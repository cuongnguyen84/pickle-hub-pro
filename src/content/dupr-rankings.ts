/**
 * DUPR rankings snapshot — parsed from www.dupr.com on 2026-05-11.
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

export type DuprFormat = "mens-singles" | "womens-singles" | "mens-doubles" | "womens-doubles";
export type DuprScope =
  | "open"
  | "junior"
  | "asia"
  | "north-america"
  | "south-america"
  | "australia-oceania"
  | "europe";

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
        "rating": 7.097
      },
      {
        "rank": 2,
        "name": "JW Johnson",
        "age": 24,
        "rating": 7.004
      },
      {
        "rank": 3,
        "name": "Andrei Daescu",
        "age": 37,
        "rating": 7.003
      },
      {
        "rank": 4,
        "name": "Hayden Patriquin",
        "age": 20,
        "rating": 6.914
      },
      {
        "rank": 5,
        "name": "Gabriel Tardio",
        "age": 20,
        "rating": 6.853
      },
      {
        "rank": 6,
        "name": "Christian Alshon",
        "age": 25,
        "rating": 6.847
      },
      {
        "rank": 7,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.736
      },
      {
        "rank": 8,
        "name": "CJ Klinger",
        "age": 20,
        "rating": 6.674
      },
      {
        "rank": 9,
        "name": "Riley Newman",
        "age": 32,
        "rating": 6.667
      },
      {
        "rank": 10,
        "name": "Jay Devilliers",
        "age": 31,
        "rating": 6.63
      },
      {
        "rank": 11,
        "name": "Will Howells",
        "age": 27,
        "rating": 6.621
      },
      {
        "rank": 12,
        "name": "Eric Oncins",
        "age": 24,
        "rating": 6.613
      },
      {
        "rank": 13,
        "name": "James Ignatowich",
        "age": 25,
        "rating": 6.585
      },
      {
        "rank": 14,
        "name": "Dekel Bar",
        "age": 33,
        "rating": 6.574
      },
      {
        "rank": 15,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.565
      },
      {
        "rank": 16,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.546
      },
      {
        "rank": 17,
        "name": "Jack Sock",
        "age": 33,
        "rating": 6.514
      },
      {
        "rank": 18,
        "name": "Dylan Frazier",
        "age": 24,
        "rating": 6.473
      },
      {
        "rank": 19,
        "name": "Nicolas Acevedo",
        "age": 26,
        "rating": 6.443
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
        "rating": 6.421
      },
      {
        "rank": 22,
        "name": "Tyson Mcguffin",
        "age": 37,
        "rating": 6.415
      },
      {
        "rank": 23,
        "name": "Pablo Tellez",
        "age": 30,
        "rating": 6.397
      },
      {
        "rank": 24,
        "name": "Quang Duong",
        "age": 20,
        "rating": 6.368
      },
      {
        "rank": 25,
        "name": "Robert Slutsky",
        "age": 25,
        "rating": 6.361
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.925
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": 26,
        "rating": 6.554
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": 25,
        "rating": 6.336
      },
      {
        "rank": 4,
        "name": "Sofia Sewing",
        "age": 26,
        "rating": 6.28
      },
      {
        "rank": 5,
        "name": "Parris Todd",
        "age": 28,
        "rating": 6.256
      },
      {
        "rank": 6,
        "name": "Jackie Kawamoto",
        "age": 30,
        "rating": 6.25
      },
      {
        "rank": 7,
        "name": "Jorja Johnson",
        "age": 19,
        "rating": 6.249
      },
      {
        "rank": 8,
        "name": "Jade Kawamoto",
        "age": 30,
        "rating": 6.243
      },
      {
        "rank": 9,
        "name": "Tina Pisnik",
        "age": 45,
        "rating": 6.232
      },
      {
        "rank": 10,
        "name": "Rachel Rohrabacher",
        "age": 28,
        "rating": 6.221
      },
      {
        "rank": 11,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 6.157
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
        "rating": 6.077
      },
      {
        "rank": 14,
        "name": "Mariechristine Salvas",
        "age": 38,
        "rating": 6.076
      },
      {
        "rank": 15,
        "name": "Vivian Glozman",
        "age": 26,
        "rating": 6.07
      },
      {
        "rank": 16,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 6.042
      },
      {
        "rank": 17,
        "name": "Kate Fahey",
        "age": 29,
        "rating": 6.029
      },
      {
        "rank": 18,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": 50,
        "rating": 5.995
      },
      {
        "rank": 19,
        "name": "Katerina Stewart",
        "age": 28,
        "rating": 5.989
      },
      {
        "rank": 20,
        "name": "Meghan Dizon",
        "age": 33,
        "rating": 5.968
      },
      {
        "rank": 21,
        "name": "Etta Tuionetoa",
        "age": 34,
        "rating": 5.965
      },
      {
        "rank": 22,
        "name": "Danni-Elle Townsend",
        "age": 22,
        "rating": 5.951
      },
      {
        "rank": 23,
        "name": "Allison Harris",
        "age": 33,
        "rating": 5.947
      },
      {
        "rank": 24,
        "name": "Bobbi Oshiro",
        "age": 32,
        "rating": 5.93
      },
      {
        "rank": 25,
        "name": "Lacy Schneemann",
        "age": 29,
        "rating": 5.927
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Haworth",
        "age": 33,
        "rating": 6.786
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
        "rating": 6.741
      },
      {
        "rank": 4,
        "name": "Zane Ford",
        "age": 21,
        "rating": 6.615
      },
      {
        "rank": 5,
        "name": "Christian Alshon",
        "age": 25,
        "rating": 6.581
      },
      {
        "rank": 6,
        "name": "Ben Johns",
        "age": 27,
        "rating": 6.568
      },
      {
        "rank": 7,
        "name": "Jack Sock",
        "age": 33,
        "rating": 6.533
      },
      {
        "rank": 8,
        "name": "Roscoe Bellamy",
        "age": 26,
        "rating": 6.51
      },
      {
        "rank": 9,
        "name": "Ammar Wazir",
        "age": 23,
        "rating": 6.485
      },
      {
        "rank": 10,
        "name": "Jaume Martinez Vich",
        "age": 32,
        "rating": 6.459
      },
      {
        "rank": 11,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.438
      },
      {
        "rank": 12,
        "name": "John Goins",
        "age": 18,
        "rating": 6.436
      },
      {
        "rank": 13,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.404
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
        "rating": 6.306
      },
      {
        "rank": 16,
        "name": "Mota Alhouni",
        "age": 33,
        "rating": 6.3
      },
      {
        "rank": 17,
        "name": "Matthew Barlow",
        "age": 31,
        "rating": 6.285
      },
      {
        "rank": 18,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.274
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
        "name": "Adam Harvey",
        "age": 24,
        "rating": 6.261
      },
      {
        "rank": 22,
        "name": "Gabriel Joseph",
        "age": 29,
        "rating": 6.257
      },
      {
        "rank": 23,
        "name": "Gabriel Tardio",
        "age": 20,
        "rating": 6.255
      },
      {
        "rank": 24,
        "name": "Yates Johnson",
        "age": 31,
        "rating": 6.249
      },
      {
        "rank": 25,
        "name": "Luca Mack",
        "age": 25,
        "rating": 6.244
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
        "rating": 6.138
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
        "rating": 5.886
      },
      {
        "rank": 7,
        "name": "Kaitlyn Christian",
        "age": 34,
        "rating": 5.879
      },
      {
        "rank": 8,
        "name": "Seone Mendez",
        "age": 26,
        "rating": 5.875
      },
      {
        "rank": 9,
        "name": "Brooke Buckner",
        "age": 34,
        "rating": 5.871
      },
      {
        "rank": 10,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.787
      },
      {
        "rank": 11,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 5.78
      },
      {
        "rank": 12,
        "name": "Genie Bouchard",
        "age": 32,
        "rating": 5.769
      },
      {
        "rank": 13,
        "name": "Judit Castillo Gargallo",
        "age": 27,
        "rating": 5.759
      },
      {
        "rank": 14,
        "name": "Sahra Dennehy",
        "age": 23,
        "rating": 5.718
      },
      {
        "rank": 15,
        "name": "Chao Yi Wang",
        "age": 23,
        "rating": 5.692
      },
      {
        "rank": 16,
        "name": "Mary Brascia",
        "age": 26,
        "rating": 5.684
      },
      {
        "rank": 17,
        "name": "Andie Dikosavljevic",
        "age": 30,
        "rating": 5.676
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
        "name": "Yufei Long",
        "age": 27,
        "rating": 5.638
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
        "rating": 5.619
      },
      {
        "rank": 25,
        "name": "Victoria DiMuzio",
        "age": 27,
        "rating": 5.597
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
        "rating": 6.082
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
        "rating": 5.966
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
        "rating": 5.826
      },
      {
        "rank": 7,
        "name": "Will Coffey",
        "age": 18,
        "rating": 5.752
      },
      {
        "rank": 8,
        "name": "Mateusz Matysik",
        "age": 18,
        "rating": 5.752
      },
      {
        "rank": 9,
        "name": "Mauro Garcia Sanchez",
        "age": 18,
        "rating": 5.694
      },
      {
        "rank": 10,
        "name": "Parth Mody",
        "age": 17,
        "rating": 5.648
      },
      {
        "rank": 11,
        "name": "Andre Mercado",
        "age": 16,
        "rating": 5.631
      },
      {
        "rank": 12,
        "name": "George Rangelov",
        "age": 18,
        "rating": 5.623
      },
      {
        "rank": 13,
        "name": "Karthik Ganesh",
        "age": 18,
        "rating": 5.607
      },
      {
        "rank": 14,
        "name": "Jace Howard",
        "age": 17,
        "rating": 5.597
      },
      {
        "rank": 15,
        "name": "Dale Kim",
        "age": 18,
        "rating": 5.581
      },
      {
        "rank": 16,
        "name": "Braden Jacobson",
        "age": 16,
        "rating": 5.566
      },
      {
        "rank": 17,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.564
      },
      {
        "rank": 18,
        "name": "Aj Marrero",
        "age": 17,
        "rating": 5.556
      },
      {
        "rank": 19,
        "name": "Arwid Dahlin",
        "age": 17,
        "rating": 5.555
      },
      {
        "rank": 20,
        "name": "Ethan Bakalinsky",
        "age": 15,
        "rating": 5.535
      },
      {
        "rank": 21,
        "name": "Ben Slive",
        "age": 16,
        "rating": 5.532
      },
      {
        "rank": 22,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.531
      },
      {
        "rank": 23,
        "name": "Jaxon Madsen",
        "age": 18,
        "rating": 5.53
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
        "rating": 5.634
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 15,
        "rating": 5.583
      },
      {
        "rank": 3,
        "name": "Aline Morales",
        "age": 15,
        "rating": 5.469
      },
      {
        "rank": 4,
        "name": "Alexa Schull",
        "age": 18,
        "rating": 5.458
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
        "rating": 5.383
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
        "rating": 5.251
      },
      {
        "rank": 11,
        "name": "Jaeda Minniefield",
        "age": 16,
        "rating": 5.232
      },
      {
        "rank": 12,
        "name": "Mary McGowan",
        "age": 17,
        "rating": 5.22
      },
      {
        "rank": 13,
        "name": "Victoria Nguyen",
        "age": 17,
        "rating": 5.191
      },
      {
        "rank": 14,
        "name": "Sophia Tran Phuong Anh",
        "age": 18,
        "rating": 5.179
      },
      {
        "rank": 15,
        "name": "Kei Sawaki",
        "age": 15,
        "rating": 5.165
      },
      {
        "rank": 16,
        "name": "Jade Rau",
        "age": 16,
        "rating": 5.158
      },
      {
        "rank": 17,
        "name": "Kayla Williams",
        "age": 15,
        "rating": 5.154
      },
      {
        "rank": 18,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 5.154
      },
      {
        "rank": 19,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 5.118
      },
      {
        "rank": 20,
        "name": "Agnimitra Bhavatosh Bhattacharya",
        "age": 18,
        "rating": 5.045
      },
      {
        "rank": 21,
        "name": "Ella Cosma",
        "age": 17,
        "rating": 5.031
      },
      {
        "rank": 22,
        "name": "Victoria A Simon",
        "age": 16,
        "rating": 5.004
      },
      {
        "rank": 23,
        "name": "Naomi Amalsadiwala",
        "age": 16,
        "rating": 4.995
      },
      {
        "rank": 24,
        "name": "Georghette Ochoa",
        "age": 15,
        "rating": 4.989
      },
      {
        "rank": 25,
        "name": "Mary Monson",
        "age": 17,
        "rating": 4.975
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.436
      },
      {
        "rank": 2,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.274
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
        "rating": 5.828
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
        "rating": 5.548
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
        "name": "Braden Jacobson",
        "age": 16,
        "rating": 5.494
      },
      {
        "rank": 14,
        "name": "Mateusz Matysik",
        "age": 18,
        "rating": 5.48
      },
      {
        "rank": 15,
        "name": "Mauro Garcia Sanchez",
        "age": 18,
        "rating": 5.419
      },
      {
        "rank": 16,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.391
      },
      {
        "rank": 17,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.379
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
        "name": "Wil Shaffer",
        "age": 17,
        "rating": 5.358
      },
      {
        "rank": 21,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.33
      },
      {
        "rank": 22,
        "name": "Hector Sanchez Vidal",
        "age": 17,
        "rating": 5.3
      },
      {
        "rank": 23,
        "name": "Dylan Wilhelm",
        "age": 18,
        "rating": 5.281
      },
      {
        "rank": 24,
        "name": "Jace Howard",
        "age": 17,
        "rating": 5.242
      },
      {
        "rank": 25,
        "name": "Purvansh Patel",
        "age": 16,
        "rating": 5.222
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.787
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 15,
        "rating": 5.464
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
        "name": "Emma Nelson",
        "age": 15,
        "rating": 5.128
      },
      {
        "rank": 6,
        "name": "Jade Rau",
        "age": 16,
        "rating": 5.013
      },
      {
        "rank": 7,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 4.941
      },
      {
        "rank": 8,
        "name": "Sophia Tran Phuong Anh",
        "age": 18,
        "rating": 4.92
      },
      {
        "rank": 9,
        "name": "Lynn Lim",
        "age": 16,
        "rating": 4.919
      },
      {
        "rank": 10,
        "name": "Kei Sawaki",
        "age": 15,
        "rating": 4.917
      },
      {
        "rank": 11,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 4.882
      },
      {
        "rank": 12,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 4.869
      },
      {
        "rank": 13,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 4.865
      },
      {
        "rank": 14,
        "name": "Kayla Williams",
        "age": 15,
        "rating": 4.841
      },
      {
        "rank": 15,
        "name": "Caroline Maguire",
        "age": 14,
        "rating": 4.755
      },
      {
        "rank": 16,
        "name": "Aria Henare",
        "age": 16,
        "rating": 4.698
      },
      {
        "rank": 17,
        "name": "Agnimitra Bhavatosh Bhattacharya",
        "age": 18,
        "rating": 4.652
      },
      {
        "rank": 18,
        "name": "Jing Robinson",
        "age": 14,
        "rating": 4.642
      },
      {
        "rank": 19,
        "name": "Stevie Petropouleas",
        "age": 14,
        "rating": 4.597
      },
      {
        "rank": 20,
        "name": "Veera Selanne",
        "age": 18,
        "rating": 4.563
      },
      {
        "rank": 21,
        "name": "Eliana Ling",
        "age": 17,
        "rating": 4.546
      },
      {
        "rank": 22,
        "name": "Diane Huynh",
        "age": 14,
        "rating": 4.522
      },
      {
        "rank": 23,
        "name": "Natalia Simson",
        "age": 13,
        "rating": 4.517
      },
      {
        "rank": 24,
        "name": "Lizzie McFarland",
        "age": 15,
        "rating": 4.512
      },
      {
        "rank": 25,
        "name": "Aline Morales",
        "age": 15,
        "rating": 4.505
      }
    ]
  },
  "asia": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 6.315
      },
      {
        "rank": 2,
        "name": "Quang Duong",
        "age": null,
        "rating": 6.3
      },
      {
        "rank": 3,
        "name": "Jonathan Truong",
        "age": null,
        "rating": 6.3
      },
      {
        "rank": 4,
        "name": "Yuta Funemizu",
        "age": null,
        "rating": 6.253
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
        "rating": 6.136
      },
      {
        "rank": 7,
        "name": "Thomas Yu",
        "age": null,
        "rating": 6.125
      },
      {
        "rank": 8,
        "name": "Kailas Shekar",
        "age": null,
        "rating": 5.978
      },
      {
        "rank": 9,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.971
      },
      {
        "rank": 10,
        "name": "Alex Emery",
        "age": null,
        "rating": 5.968
      },
      {
        "rank": 11,
        "name": "Harsh Mehta",
        "age": null,
        "rating": 5.965
      },
      {
        "rank": 12,
        "name": "Eric Roddy",
        "age": null,
        "rating": 5.953
      },
      {
        "rank": 13,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 5.915
      },
      {
        "rank": 14,
        "name": "Sanil Jagtiani",
        "age": null,
        "rating": 5.89
      },
      {
        "rank": 15,
        "name": "Truong Hien",
        "age": null,
        "rating": 5.873
      },
      {
        "rank": 16,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.866
      },
      {
        "rank": 17,
        "name": "Eunggwon Kim",
        "age": null,
        "rating": 5.86
      },
      {
        "rank": 18,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.848
      },
      {
        "rank": 19,
        "name": "Santhosh Narayanan",
        "age": null,
        "rating": 5.844
      },
      {
        "rank": 20,
        "name": "James Yu",
        "age": null,
        "rating": 5.821
      },
      {
        "rank": 21,
        "name": "Phuc Huynh",
        "age": null,
        "rating": 5.817
      },
      {
        "rank": 22,
        "name": "Aryaan Bhatia",
        "age": null,
        "rating": 5.767
      },
      {
        "rank": 23,
        "name": "Usama Khalid Sam",
        "age": null,
        "rating": 5.721
      },
      {
        "rank": 24,
        "name": "Vanshik Kapadia",
        "age": null,
        "rating": 5.72
      },
      {
        "rank": 25,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.697
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Aibika Kalsarieva",
        "age": null,
        "rating": 5.853
      },
      {
        "rank": 2,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.852
      },
      {
        "rank": 3,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.806
      },
      {
        "rank": 4,
        "name": "Alix Truong",
        "age": null,
        "rating": 5.784
      },
      {
        "rank": 5,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.77
      },
      {
        "rank": 6,
        "name": "Nicole Eugenio",
        "age": null,
        "rating": 5.731
      },
      {
        "rank": 7,
        "name": "Marisa Ruiz",
        "age": null,
        "rating": 5.683
      },
      {
        "rank": 8,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.57
      },
      {
        "rank": 9,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.567
      },
      {
        "rank": 10,
        "name": "Kara Wheatley",
        "age": null,
        "rating": 5.531
      },
      {
        "rank": 11,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.491
      },
      {
        "rank": 12,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.456
      },
      {
        "rank": 13,
        "name": "Ken Tam",
        "age": null,
        "rating": 5.441
      },
      {
        "rank": 14,
        "name": "Vritti Sethi",
        "age": null,
        "rating": 5.427
      },
      {
        "rank": 15,
        "name": "Sarah Jane Lim",
        "age": null,
        "rating": 5.418
      },
      {
        "rank": 16,
        "name": "Xiao Yi Wang Beckvall",
        "age": null,
        "rating": 5.418
      },
      {
        "rank": 17,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.408
      },
      {
        "rank": 18,
        "name": "Kai Fen Yi",
        "age": null,
        "rating": 5.398
      },
      {
        "rank": 19,
        "name": "Emma Ruoyi Li",
        "age": null,
        "rating": 5.369
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
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.312
      },
      {
        "rank": 23,
        "name": "Connie Lee",
        "age": null,
        "rating": 5.275
      },
      {
        "rank": 24,
        "name": "Naimi Mehta",
        "age": null,
        "rating": 5.272
      },
      {
        "rank": 25,
        "name": "Tingwen Wang",
        "age": null,
        "rating": 5.256
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
        "name": "Eric Roddy",
        "age": null,
        "rating": 6.128
      },
      {
        "rank": 4,
        "name": "Luc Pham",
        "age": null,
        "rating": 6.069
      },
      {
        "rank": 5,
        "name": "Truong Hien",
        "age": null,
        "rating": 6.062
      },
      {
        "rank": 6,
        "name": "Thomas Yu",
        "age": null,
        "rating": 6.044
      },
      {
        "rank": 7,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 6.039
      },
      {
        "rank": 8,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.934
      },
      {
        "rank": 9,
        "name": "Cheng En Tsai",
        "age": null,
        "rating": 5.892
      },
      {
        "rank": 10,
        "name": "Hoàng Nguyễn Việt",
        "age": null,
        "rating": 5.873
      },
      {
        "rank": 11,
        "name": "Giang Trinh",
        "age": null,
        "rating": 5.752
      },
      {
        "rank": 12,
        "name": "Nguyen Hung Anh",
        "age": null,
        "rating": 5.715
      },
      {
        "rank": 13,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.693
      },
      {
        "rank": 14,
        "name": "Nasa Hatakeyama",
        "age": null,
        "rating": 5.679
      },
      {
        "rank": 15,
        "name": "Shay Hugo",
        "age": null,
        "rating": 5.632
      },
      {
        "rank": 16,
        "name": "Kento Tamaki",
        "age": null,
        "rating": 5.577
      },
      {
        "rank": 17,
        "name": "Kenneth Lee",
        "age": null,
        "rating": 5.566
      },
      {
        "rank": 18,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.545
      },
      {
        "rank": 19,
        "name": "Vũ Phạm",
        "age": null,
        "rating": 5.541
      },
      {
        "rank": 20,
        "name": "Jimmy Liong Kai Long",
        "age": null,
        "rating": 5.515
      },
      {
        "rank": 21,
        "name": "Aditya Ruhela",
        "age": null,
        "rating": 5.454
      },
      {
        "rank": 22,
        "name": "Arjun Singh",
        "age": null,
        "rating": 5.434
      },
      {
        "rank": 23,
        "name": "Aman Patel",
        "age": null,
        "rating": 5.428
      },
      {
        "rank": 24,
        "name": "Aryaan Bhatia",
        "age": null,
        "rating": 5.381
      },
      {
        "rank": 25,
        "name": "Daniel Byun",
        "age": null,
        "rating": 5.367
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.649
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
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.502
      },
      {
        "rank": 5,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.423
      },
      {
        "rank": 6,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.4
      },
      {
        "rank": 7,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.371
      },
      {
        "rank": 8,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.362
      },
      {
        "rank": 9,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.307
      },
      {
        "rank": 10,
        "name": "Mihika Yadav",
        "age": null,
        "rating": 5.294
      },
      {
        "rank": 11,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.183
      },
      {
        "rank": 12,
        "name": "Albie Huang",
        "age": null,
        "rating": 5.18
      },
      {
        "rank": 13,
        "name": "Aaliya Ebrahim",
        "age": null,
        "rating": 5.169
      },
      {
        "rank": 14,
        "name": "Anna Clarice Patrimonio",
        "age": null,
        "rating": 5.061
      },
      {
        "rank": 15,
        "name": "Yunqi He",
        "age": null,
        "rating": 5.053
      },
      {
        "rank": 16,
        "name": "Ying Suet Lam",
        "age": null,
        "rating": 5.042
      },
      {
        "rank": 17,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.036
      },
      {
        "rank": 18,
        "name": "Ken Tam",
        "age": null,
        "rating": 4.98
      },
      {
        "rank": 19,
        "name": "Christy Sañosa",
        "age": null,
        "rating": 4.978
      },
      {
        "rank": 20,
        "name": "Pei-Yu Lai",
        "age": null,
        "rating": 4.967
      },
      {
        "rank": 21,
        "name": "Snehal Patil",
        "age": null,
        "rating": 4.938
      },
      {
        "rank": 22,
        "name": "Sophia Huỳnh Trần Ngọc Nhi",
        "age": null,
        "rating": 4.925
      },
      {
        "rank": 23,
        "name": "Venise Chan",
        "age": null,
        "rating": 4.924
      },
      {
        "rank": 24,
        "name": "Sophia Tran Phuong Anh",
        "age": null,
        "rating": 4.92
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
        "rating": 7.098
      },
      {
        "rank": 2,
        "name": "Jw Johnson",
        "age": null,
        "rating": 6.987
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": null,
        "rating": 6.925
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.861
      },
      {
        "rank": 5,
        "name": "Cj Klinger",
        "age": null,
        "rating": 6.71
      },
      {
        "rank": 6,
        "name": "Riley Newman",
        "age": null,
        "rating": 6.702
      },
      {
        "rank": 7,
        "name": "Will Howells",
        "age": null,
        "rating": 6.654
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
        "rating": 6.579
      },
      {
        "rank": 10,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.529
      },
      {
        "rank": 11,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.524
      },
      {
        "rank": 12,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.429
      },
      {
        "rank": 13,
        "name": "Tyson Mcguffin",
        "age": null,
        "rating": 6.421
      },
      {
        "rank": 14,
        "name": "Matt Wright",
        "age": null,
        "rating": 6.417
      },
      {
        "rank": 15,
        "name": "Zane Navratil",
        "age": null,
        "rating": 6.387
      },
      {
        "rank": 16,
        "name": "Augustus Ge",
        "age": null,
        "rating": 6.37
      },
      {
        "rank": 17,
        "name": "Maxwell Freeman",
        "age": null,
        "rating": 6.344
      },
      {
        "rank": 18,
        "name": "Michael Loyd",
        "age": null,
        "rating": 6.337
      },
      {
        "rank": 19,
        "name": "Julian Arnold",
        "age": null,
        "rating": 6.329
      },
      {
        "rank": 20,
        "name": "Anderson Scarpa",
        "age": null,
        "rating": 6.312
      },
      {
        "rank": 21,
        "name": "Max Manthou",
        "age": null,
        "rating": 6.31
      },
      {
        "rank": 22,
        "name": "Marshall Brown",
        "age": null,
        "rating": 6.298
      },
      {
        "rank": 23,
        "name": "Aj Koller",
        "age": null,
        "rating": 6.298
      },
      {
        "rank": 24,
        "name": "Wyatt Stone",
        "age": null,
        "rating": 6.293
      },
      {
        "rank": 25,
        "name": "Rafa Hewett",
        "age": null,
        "rating": 6.289
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.903
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": null,
        "rating": 6.528
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": null,
        "rating": 6.315
      },
      {
        "rank": 4,
        "name": "Jackie Kawamoto",
        "age": null,
        "rating": 6.253
      },
      {
        "rank": 5,
        "name": "Jade Kawamoto",
        "age": null,
        "rating": 6.241
      },
      {
        "rank": 6,
        "name": "Parris Todd",
        "age": null,
        "rating": 6.219
      },
      {
        "rank": 7,
        "name": "Rachel Rohrabacher",
        "age": null,
        "rating": 6.211
      },
      {
        "rank": 8,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 6.208
      },
      {
        "rank": 9,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.188
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
        "rating": 6.103
      },
      {
        "rank": 12,
        "name": "Meghan Dizon",
        "age": null,
        "rating": 5.991
      },
      {
        "rank": 13,
        "name": "Kate Fahey",
        "age": null,
        "rating": 5.985
      },
      {
        "rank": 14,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 5.976
      },
      {
        "rank": 15,
        "name": "Etta Tuionetoa",
        "age": null,
        "rating": 5.975
      },
      {
        "rank": 16,
        "name": "Lacy Schneemann",
        "age": null,
        "rating": 5.961
      },
      {
        "rank": 17,
        "name": "Allison Harris",
        "age": null,
        "rating": 5.953
      },
      {
        "rank": 18,
        "name": "Jillian Braverman",
        "age": null,
        "rating": 5.912
      },
      {
        "rank": 19,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.907
      },
      {
        "rank": 20,
        "name": "Vivian Glozman",
        "age": null,
        "rating": 5.893
      },
      {
        "rank": 21,
        "name": "Allyce Jones",
        "age": null,
        "rating": 5.879
      },
      {
        "rank": 22,
        "name": "Callie Smith",
        "age": null,
        "rating": 5.878
      },
      {
        "rank": 23,
        "name": "Christine Maddox",
        "age": null,
        "rating": 5.856
      },
      {
        "rank": 24,
        "name": "Sheri Courter",
        "age": null,
        "rating": 5.855
      },
      {
        "rank": 25,
        "name": "Pam Ruoff",
        "age": null,
        "rating": 5.847
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Haworth",
        "age": null,
        "rating": 6.826
      },
      {
        "rank": 2,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.804
      },
      {
        "rank": 3,
        "name": "Ben Johns",
        "age": null,
        "rating": 6.668
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.645
      },
      {
        "rank": 5,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.57
      },
      {
        "rank": 6,
        "name": "Zane Ford",
        "age": null,
        "rating": 6.57
      },
      {
        "rank": 7,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.536
      },
      {
        "rank": 8,
        "name": "John Goins",
        "age": null,
        "rating": 6.454
      },
      {
        "rank": 9,
        "name": "Yates Johnson",
        "age": null,
        "rating": 6.423
      },
      {
        "rank": 10,
        "name": "Ronan Camron",
        "age": null,
        "rating": 6.383
      },
      {
        "rank": 11,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.348
      },
      {
        "rank": 12,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.344
      },
      {
        "rank": 13,
        "name": "Adam Harvey",
        "age": null,
        "rating": 6.315
      },
      {
        "rank": 14,
        "name": "Gabriel Joseph",
        "age": null,
        "rating": 6.284
      },
      {
        "rank": 15,
        "name": "Alexander Crum",
        "age": null,
        "rating": 6.281
      },
      {
        "rank": 16,
        "name": "Donald Young",
        "age": null,
        "rating": 6.251
      },
      {
        "rank": 17,
        "name": "Jw Johnson",
        "age": null,
        "rating": 6.245
      },
      {
        "rank": 18,
        "name": "Matthew Barlow",
        "age": null,
        "rating": 6.234
      },
      {
        "rank": 19,
        "name": "Grayson Goldin",
        "age": null,
        "rating": 6.231
      },
      {
        "rank": 20,
        "name": "Rafa Hewett",
        "age": null,
        "rating": 6.202
      },
      {
        "rank": 21,
        "name": "Max Green",
        "age": null,
        "rating": 6.194
      },
      {
        "rank": 22,
        "name": "Cason Campbell",
        "age": null,
        "rating": 6.158
      },
      {
        "rank": 23,
        "name": "Maxwell Freeman",
        "age": null,
        "rating": 6.151
      },
      {
        "rank": 24,
        "name": "Tama Shimabukuro",
        "age": null,
        "rating": 6.137
      },
      {
        "rank": 25,
        "name": "Tyson Mcguffin",
        "age": null,
        "rating": 6.121
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.491
      },
      {
        "rank": 2,
        "name": "Parris Todd",
        "age": null,
        "rating": 6.105
      },
      {
        "rank": 3,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.076
      },
      {
        "rank": 4,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 6.047
      },
      {
        "rank": 5,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 5.99
      },
      {
        "rank": 6,
        "name": "Lea Jansen",
        "age": null,
        "rating": 5.93
      },
      {
        "rank": 7,
        "name": "Kaitlyn Christian",
        "age": null,
        "rating": 5.898
      },
      {
        "rank": 8,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.877
      },
      {
        "rank": 9,
        "name": "Genie Bouchard",
        "age": null,
        "rating": 5.844
      },
      {
        "rank": 10,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 5.836
      },
      {
        "rank": 11,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 5.766
      },
      {
        "rank": 12,
        "name": "Kiora Kunimoto",
        "age": null,
        "rating": 5.723
      },
      {
        "rank": 13,
        "name": "Samantha Parker",
        "age": null,
        "rating": 5.708
      },
      {
        "rank": 14,
        "name": "Mary Brascia",
        "age": null,
        "rating": 5.684
      },
      {
        "rank": 15,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.669
      },
      {
        "rank": 16,
        "name": "Isabella Dunlap",
        "age": null,
        "rating": 5.563
      },
      {
        "rank": 17,
        "name": "Victoria Dimuzio",
        "age": null,
        "rating": 5.561
      },
      {
        "rank": 18,
        "name": "Liz Truluck",
        "age": null,
        "rating": 5.477
      },
      {
        "rank": 19,
        "name": "Cailyn Campbell",
        "age": null,
        "rating": 5.432
      },
      {
        "rank": 20,
        "name": "Zoey Weil",
        "age": null,
        "rating": 5.428
      },
      {
        "rank": 21,
        "name": "Milan Rane",
        "age": null,
        "rating": 5.416
      },
      {
        "rank": 22,
        "name": "Keilly Ulery",
        "age": null,
        "rating": 5.399
      },
      {
        "rank": 23,
        "name": "Spencer Liang",
        "age": null,
        "rating": 5.396
      },
      {
        "rank": 24,
        "name": "Hannah Blatt",
        "age": null,
        "rating": 5.394
      },
      {
        "rank": 25,
        "name": "Amber Policare",
        "age": null,
        "rating": 5.358
      }
    ]
  },
  "south-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Gabriel Tardio",
        "age": null,
        "rating": 6.895
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
        "rating": 6.642
      },
      {
        "rank": 4,
        "name": "Pablo Tellez",
        "age": null,
        "rating": 6.367
      },
      {
        "rank": 5,
        "name": "Jaime Oncins",
        "age": null,
        "rating": 6.058
      },
      {
        "rank": 6,
        "name": "Juan Benitez",
        "age": null,
        "rating": 6.056
      },
      {
        "rank": 7,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.031
      },
      {
        "rank": 8,
        "name": "Bruno Faletto",
        "age": null,
        "rating": 6.023
      },
      {
        "rank": 9,
        "name": "Mario Barrientos",
        "age": null,
        "rating": 5.905
      },
      {
        "rank": 10,
        "name": "Carlos Di Laura",
        "age": null,
        "rating": 5.826
      },
      {
        "rank": 11,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.816
      },
      {
        "rank": 12,
        "name": "Patricio Pereyra",
        "age": null,
        "rating": 5.749
      },
      {
        "rank": 13,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.732
      },
      {
        "rank": 14,
        "name": "Andre Millet",
        "age": null,
        "rating": 5.692
      },
      {
        "rank": 15,
        "name": "Caio Bardauil",
        "age": null,
        "rating": 5.663
      },
      {
        "rank": 16,
        "name": "Miguel Alda",
        "age": null,
        "rating": 5.505
      },
      {
        "rank": 17,
        "name": "Federico Nani",
        "age": null,
        "rating": 5.487
      },
      {
        "rank": 18,
        "name": "Armando Ferreira",
        "age": null,
        "rating": 5.447
      },
      {
        "rank": 19,
        "name": "Alex Simon",
        "age": null,
        "rating": 5.41
      },
      {
        "rank": 20,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.407
      },
      {
        "rank": 21,
        "name": "Juan Medina",
        "age": null,
        "rating": 5.336
      },
      {
        "rank": 22,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.327
      },
      {
        "rank": 23,
        "name": "Rodrigo Reyes",
        "age": null,
        "rating": 5.32
      },
      {
        "rank": 24,
        "name": "Victor Frota",
        "age": null,
        "rating": 5.318
      },
      {
        "rank": 25,
        "name": "Rafael Munehide Kayo",
        "age": null,
        "rating": 5.301
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 6.099
      },
      {
        "rank": 2,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 5.976
      },
      {
        "rank": 3,
        "name": "Pierina Imparato",
        "age": null,
        "rating": 5.537
      },
      {
        "rank": 4,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 5.274
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
        "rating": 5.223
      },
      {
        "rank": 7,
        "name": "Bequi Barros Behar Luizelli",
        "age": null,
        "rating": 5.18
      },
      {
        "rank": 8,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.038
      },
      {
        "rank": 9,
        "name": "Tatiana Ruhl",
        "age": null,
        "rating": 4.964
      },
      {
        "rank": 10,
        "name": "Arianna Raga",
        "age": null,
        "rating": 4.939
      },
      {
        "rank": 11,
        "name": "Ali Quintero",
        "age": null,
        "rating": 4.879
      },
      {
        "rank": 12,
        "name": "Valentina Martin",
        "age": null,
        "rating": 4.833
      },
      {
        "rank": 13,
        "name": "Mariana Jimenez",
        "age": null,
        "rating": 4.83
      },
      {
        "rank": 14,
        "name": "Muyasser Bresh",
        "age": null,
        "rating": 4.815
      },
      {
        "rank": 15,
        "name": "Mariana Paredes",
        "age": null,
        "rating": 4.81
      },
      {
        "rank": 16,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.81
      },
      {
        "rank": 17,
        "name": "Dayana Fahey",
        "age": null,
        "rating": 4.766
      },
      {
        "rank": 18,
        "name": "Camila Militao",
        "age": null,
        "rating": 4.753
      },
      {
        "rank": 19,
        "name": "Karina Salles",
        "age": null,
        "rating": 4.738
      },
      {
        "rank": 20,
        "name": "Patricia Medrado",
        "age": null,
        "rating": 4.735
      },
      {
        "rank": 21,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.726
      },
      {
        "rank": 22,
        "name": "Katie Neils",
        "age": null,
        "rating": 4.704
      },
      {
        "rank": 23,
        "name": "Andressa Mossri",
        "age": null,
        "rating": 4.637
      },
      {
        "rank": 24,
        "name": "Marcelle Prates",
        "age": null,
        "rating": 4.593
      },
      {
        "rank": 25,
        "name": "Delfina Debenedetti",
        "age": null,
        "rating": 4.534
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.706
      },
      {
        "rank": 2,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.301
      },
      {
        "rank": 3,
        "name": "Gabriel Tardio",
        "age": null,
        "rating": 6.255
      },
      {
        "rank": 4,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.181
      },
      {
        "rank": 5,
        "name": "Juan Benitez",
        "age": null,
        "rating": 5.857
      },
      {
        "rank": 6,
        "name": "Andre Millet",
        "age": null,
        "rating": 5.766
      },
      {
        "rank": 7,
        "name": "Armando Ferreira",
        "age": null,
        "rating": 5.446
      },
      {
        "rank": 8,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.23
      },
      {
        "rank": 9,
        "name": "Rafael Munehide Kayo",
        "age": null,
        "rating": 5.207
      },
      {
        "rank": 10,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.177
      },
      {
        "rank": 11,
        "name": "Nicolas Almeida",
        "age": null,
        "rating": 5.102
      },
      {
        "rank": 12,
        "name": "Bruno Semino",
        "age": null,
        "rating": 5.087
      },
      {
        "rank": 13,
        "name": "Tony Ottamendi",
        "age": null,
        "rating": 5.082
      },
      {
        "rank": 14,
        "name": "Cristobal Del Castillo",
        "age": null,
        "rating": 4.953
      },
      {
        "rank": 15,
        "name": "Juan Pablo Pinilla",
        "age": null,
        "rating": 4.931
      },
      {
        "rank": 16,
        "name": "Rodrigo  Borrero",
        "age": null,
        "rating": 4.899
      },
      {
        "rank": 17,
        "name": "Eduardo Correia",
        "age": null,
        "rating": 4.867
      },
      {
        "rank": 18,
        "name": "Adrian Morales",
        "age": null,
        "rating": 4.866
      },
      {
        "rank": 19,
        "name": "Thiago Soto",
        "age": null,
        "rating": 4.833
      },
      {
        "rank": 20,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 4.781
      },
      {
        "rank": 21,
        "name": "Caian  Matos",
        "age": null,
        "rating": 4.763
      },
      {
        "rank": 22,
        "name": "Bernardo Valdes",
        "age": null,
        "rating": 4.731
      },
      {
        "rank": 23,
        "name": "Juan Manuel Pinzon Restrepo",
        "age": null,
        "rating": 4.71
      },
      {
        "rank": 24,
        "name": "Samuel Giraldo",
        "age": null,
        "rating": 4.671
      },
      {
        "rank": 25,
        "name": "Fabian Deramond",
        "age": null,
        "rating": 4.637
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
        "name": "Lina  Romero Alarcon",
        "age": null,
        "rating": 4.624
      },
      {
        "rank": 3,
        "name": "Sofia Daniela Rodriguez Camejo",
        "age": null,
        "rating": 4.451
      },
      {
        "rank": 4,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.329
      },
      {
        "rank": 5,
        "name": "Ana Sánchez",
        "age": null,
        "rating": 4.274
      },
      {
        "rank": 6,
        "name": "Carolina Ledesma",
        "age": null,
        "rating": 4.012
      },
      {
        "rank": 7,
        "name": "Alejandra Báez",
        "age": null,
        "rating": 3.715
      }
    ]
  },
  "australia-oceania": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "George Wall",
        "age": null,
        "rating": 6.088
      },
      {
        "rank": 2,
        "name": "Andre Mick",
        "age": null,
        "rating": 6.056
      },
      {
        "rank": 3,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.981
      },
      {
        "rank": 4,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.944
      },
      {
        "rank": 5,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.849
      },
      {
        "rank": 6,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.77
      },
      {
        "rank": 7,
        "name": "Robert Claveria Stirling",
        "age": null,
        "rating": 5.755
      },
      {
        "rank": 8,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.685
      },
      {
        "rank": 9,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.675
      },
      {
        "rank": 10,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.627
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
        "rating": 5.521
      },
      {
        "rank": 13,
        "name": "Ciaran Lavers",
        "age": null,
        "rating": 5.474
      },
      {
        "rank": 14,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 5.425
      },
      {
        "rank": 15,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.422
      },
      {
        "rank": 16,
        "name": "Feiloakitohi Tavalea",
        "age": null,
        "rating": 5.395
      },
      {
        "rank": 17,
        "name": "Shaun Tamai",
        "age": null,
        "rating": 5.348
      },
      {
        "rank": 18,
        "name": "Jai Grewal",
        "age": null,
        "rating": 5.346
      },
      {
        "rank": 19,
        "name": "Tony Field",
        "age": null,
        "rating": 5.337
      },
      {
        "rank": 20,
        "name": "Barry Oliver George Gray",
        "age": null,
        "rating": 5.322
      },
      {
        "rank": 21,
        "name": "Will Dewhirst",
        "age": null,
        "rating": 5.309
      },
      {
        "rank": 22,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.301
      },
      {
        "rank": 23,
        "name": "Shane Wilson",
        "age": null,
        "rating": 5.297
      },
      {
        "rank": 24,
        "name": "Tristan Stayt",
        "age": null,
        "rating": 5.295
      },
      {
        "rank": 25,
        "name": "Joshua Nipperess",
        "age": null,
        "rating": 5.287
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 5.98
      },
      {
        "rank": 2,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.863
      },
      {
        "rank": 3,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.78
      },
      {
        "rank": 4,
        "name": "Somer Dallabona",
        "age": null,
        "rating": 5.752
      },
      {
        "rank": 5,
        "name": "Ashlee Candelaria",
        "age": null,
        "rating": 5.705
      },
      {
        "rank": 6,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.697
      },
      {
        "rank": 7,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.686
      },
      {
        "rank": 8,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.606
      },
      {
        "rank": 9,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.604
      },
      {
        "rank": 10,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 5.442
      },
      {
        "rank": 11,
        "name": "Sarah Burr",
        "age": null,
        "rating": 5.372
      },
      {
        "rank": 12,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 5.35
      },
      {
        "rank": 13,
        "name": "Talia Saunders",
        "age": null,
        "rating": 5.331
      },
      {
        "rank": 14,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.284
      },
      {
        "rank": 15,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.242
      },
      {
        "rank": 16,
        "name": "Tyra Calderwood",
        "age": null,
        "rating": 5.211
      },
      {
        "rank": 17,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 5.208
      },
      {
        "rank": 18,
        "name": "Brittany Yang",
        "age": null,
        "rating": 5.12
      },
      {
        "rank": 19,
        "name": "Lara Giltinan",
        "age": null,
        "rating": 5.109
      },
      {
        "rank": 20,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.08
      },
      {
        "rank": 21,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 5.056
      },
      {
        "rank": 22,
        "name": "Tayah Cross",
        "age": null,
        "rating": 5.019
      },
      {
        "rank": 23,
        "name": "Bee Horsley",
        "age": null,
        "rating": 5.006
      },
      {
        "rank": 24,
        "name": "Katerina Valos",
        "age": null,
        "rating": 4.988
      },
      {
        "rank": 25,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 4.975
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.749
      },
      {
        "rank": 2,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.657
      },
      {
        "rank": 3,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.599
      },
      {
        "rank": 4,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.454
      },
      {
        "rank": 5,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.399
      },
      {
        "rank": 6,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.303
      },
      {
        "rank": 7,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.228
      },
      {
        "rank": 8,
        "name": "Andy Van Der Vyver",
        "age": null,
        "rating": 5.227
      },
      {
        "rank": 9,
        "name": "Brian  Tran",
        "age": null,
        "rating": 5.195
      },
      {
        "rank": 10,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.183
      },
      {
        "rank": 11,
        "name": "Ashton Chan",
        "age": null,
        "rating": 5.181
      },
      {
        "rank": 12,
        "name": "Joshua Nipperess",
        "age": null,
        "rating": 5.155
      },
      {
        "rank": 13,
        "name": "Henrik Traskin",
        "age": null,
        "rating": 5.139
      },
      {
        "rank": 14,
        "name": "Joshua Barber",
        "age": null,
        "rating": 5.081
      },
      {
        "rank": 15,
        "name": "Kyron Pinter",
        "age": null,
        "rating": 5.058
      },
      {
        "rank": 16,
        "name": "Matthew Kouznetsov",
        "age": null,
        "rating": 5.052
      },
      {
        "rank": 17,
        "name": "Nigel Lee",
        "age": null,
        "rating": 5.052
      },
      {
        "rank": 18,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.023
      },
      {
        "rank": 19,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 4.994
      },
      {
        "rank": 20,
        "name": "Oliver Dobson",
        "age": null,
        "rating": 4.986
      },
      {
        "rank": 21,
        "name": "Ivan Stride",
        "age": null,
        "rating": 4.965
      },
      {
        "rank": 22,
        "name": "Ethan Chung",
        "age": null,
        "rating": 4.958
      },
      {
        "rank": 23,
        "name": "Ethan Butson",
        "age": null,
        "rating": 4.957
      },
      {
        "rank": 24,
        "name": "Stefan Djordjic",
        "age": null,
        "rating": 4.949
      },
      {
        "rank": 25,
        "name": "Liam Lamb",
        "age": null,
        "rating": 4.943
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.81
      },
      {
        "rank": 2,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.667
      },
      {
        "rank": 3,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.63
      },
      {
        "rank": 4,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.545
      },
      {
        "rank": 5,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.488
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
        "rating": 5.269
      },
      {
        "rank": 8,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 5.206
      },
      {
        "rank": 9,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.173
      },
      {
        "rank": 10,
        "name": "Jasmine Almaguer",
        "age": null,
        "rating": 5.115
      },
      {
        "rank": 11,
        "name": "Simone Kessell",
        "age": null,
        "rating": 4.948
      },
      {
        "rank": 12,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 4.932
      },
      {
        "rank": 13,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 4.927
      },
      {
        "rank": 14,
        "name": "Helena Spiridis",
        "age": null,
        "rating": 4.912
      },
      {
        "rank": 15,
        "name": "Brittany Yang",
        "age": null,
        "rating": 4.905
      },
      {
        "rank": 16,
        "name": "Karen Denman",
        "age": null,
        "rating": 4.888
      },
      {
        "rank": 17,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 4.888
      },
      {
        "rank": 18,
        "name": "Ange Green",
        "age": null,
        "rating": 4.881
      },
      {
        "rank": 19,
        "name": "Rosa Morris",
        "age": null,
        "rating": 4.808
      },
      {
        "rank": 20,
        "name": "Sarah Burr",
        "age": null,
        "rating": 4.793
      },
      {
        "rank": 21,
        "name": "Mandy Corbett",
        "age": null,
        "rating": 4.79
      },
      {
        "rank": 22,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 4.789
      },
      {
        "rank": 23,
        "name": "Miki Masui",
        "age": null,
        "rating": 4.782
      },
      {
        "rank": 24,
        "name": "Nives Baric",
        "age": null,
        "rating": 4.722
      },
      {
        "rank": 25,
        "name": "Tayah Cross",
        "age": null,
        "rating": 4.683
      }
    ]
  },
  "europe": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Andrei Daescu",
        "age": null,
        "rating": 7.022
      },
      {
        "rank": 2,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 6.651
      },
      {
        "rank": 3,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.595
      },
      {
        "rank": 4,
        "name": "Dekel Bar",
        "age": null,
        "rating": 6.566
      },
      {
        "rank": 5,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.461
      },
      {
        "rank": 6,
        "name": "Martin Emmrich",
        "age": null,
        "rating": 6.347
      },
      {
        "rank": 7,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 6.242
      },
      {
        "rank": 8,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.204
      },
      {
        "rank": 9,
        "name": "Dj Young",
        "age": null,
        "rating": 6.138
      },
      {
        "rank": 10,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 6.09
      },
      {
        "rank": 11,
        "name": "Oscar Serra",
        "age": null,
        "rating": 6.087
      },
      {
        "rank": 12,
        "name": "Stefan Auvergne",
        "age": null,
        "rating": 6.032
      },
      {
        "rank": 13,
        "name": "Tom Protzek",
        "age": null,
        "rating": 5.991
      },
      {
        "rank": 14,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.863
      },
      {
        "rank": 15,
        "name": "Domenico Geminiani",
        "age": null,
        "rating": 5.863
      },
      {
        "rank": 16,
        "name": "Patrick Smith",
        "age": null,
        "rating": 5.86
      },
      {
        "rank": 17,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 5.859
      },
      {
        "rank": 18,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.827
      },
      {
        "rank": 19,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.806
      },
      {
        "rank": 20,
        "name": "Rosen Naydenov",
        "age": null,
        "rating": 5.761
      },
      {
        "rank": 21,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.76
      },
      {
        "rank": 22,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.743
      },
      {
        "rank": 23,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.742
      },
      {
        "rank": 24,
        "name": "Mark Growcott",
        "age": null,
        "rating": 5.73
      },
      {
        "rank": 25,
        "name": "Maksims Kazijevs",
        "age": null,
        "rating": 5.727
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Tina Pisnik",
        "age": null,
        "rating": 6.223
      },
      {
        "rank": 2,
        "name": "Megan Fudge",
        "age": null,
        "rating": 6.045
      },
      {
        "rank": 3,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 5.932
      },
      {
        "rank": 4,
        "name": "Ewa Radzikowska",
        "age": null,
        "rating": 5.915
      },
      {
        "rank": 5,
        "name": "Maria Klokotzky",
        "age": null,
        "rating": 5.851
      },
      {
        "rank": 6,
        "name": "Daria Walczak",
        "age": null,
        "rating": 5.808
      },
      {
        "rank": 7,
        "name": "Lucy Kovalova",
        "age": null,
        "rating": 5.722
      },
      {
        "rank": 8,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.714
      },
      {
        "rank": 9,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.708
      },
      {
        "rank": 10,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.602
      },
      {
        "rank": 11,
        "name": "Andrea Olson",
        "age": null,
        "rating": 5.587
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
        "rating": 5.577
      },
      {
        "rank": 14,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.574
      },
      {
        "rank": 15,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.568
      },
      {
        "rank": 16,
        "name": "Martina Frantova",
        "age": null,
        "rating": 5.536
      },
      {
        "rank": 17,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.535
      },
      {
        "rank": 18,
        "name": "Christa Gecheva",
        "age": null,
        "rating": 5.525
      },
      {
        "rank": 19,
        "name": "Glauka Carvajal Lane",
        "age": null,
        "rating": 5.415
      },
      {
        "rank": 20,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.412
      },
      {
        "rank": 21,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 5.396
      },
      {
        "rank": 22,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.372
      },
      {
        "rank": 23,
        "name": "Paula Rives Palau",
        "age": null,
        "rating": 5.308
      },
      {
        "rank": 24,
        "name": "Tea Pejic",
        "age": null,
        "rating": 5.294
      },
      {
        "rank": 25,
        "name": "Joana Stark",
        "age": null,
        "rating": 5.265
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.475
      },
      {
        "rank": 2,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.462
      },
      {
        "rank": 3,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 6.297
      },
      {
        "rank": 4,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 6.259
      },
      {
        "rank": 5,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.153
      },
      {
        "rank": 6,
        "name": "Oliver Frank",
        "age": null,
        "rating": 6.141
      },
      {
        "rank": 7,
        "name": "Tom Protzek",
        "age": null,
        "rating": 6.034
      },
      {
        "rank": 8,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 5.934
      },
      {
        "rank": 9,
        "name": "Matthew Finnerty",
        "age": null,
        "rating": 5.877
      },
      {
        "rank": 10,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.83
      },
      {
        "rank": 11,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 5.824
      },
      {
        "rank": 12,
        "name": "Jasper Schaadt",
        "age": null,
        "rating": 5.72
      },
      {
        "rank": 13,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.702
      },
      {
        "rank": 14,
        "name": "James Chaudry",
        "age": null,
        "rating": 5.682
      },
      {
        "rank": 15,
        "name": "Mikołaj Biedermann",
        "age": null,
        "rating": 5.651
      },
      {
        "rank": 16,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.642
      },
      {
        "rank": 17,
        "name": "Nicholas Wade",
        "age": null,
        "rating": 5.641
      },
      {
        "rank": 18,
        "name": "Mikar Fisher",
        "age": null,
        "rating": 5.61
      },
      {
        "rank": 19,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.595
      },
      {
        "rank": 20,
        "name": "Ignasi De Rueda",
        "age": null,
        "rating": 5.579
      },
      {
        "rank": 21,
        "name": "Jorge Rodríguez Agudo",
        "age": null,
        "rating": 5.525
      },
      {
        "rank": 22,
        "name": "Bartosz Karbownik",
        "age": null,
        "rating": 5.523
      },
      {
        "rank": 23,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.493
      },
      {
        "rank": 24,
        "name": "Platel Theo",
        "age": null,
        "rating": 5.448
      },
      {
        "rank": 25,
        "name": "Antoine Schaub",
        "age": null,
        "rating": 5.445
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.652
      },
      {
        "rank": 2,
        "name": "Salome Devidze",
        "age": null,
        "rating": 5.648
      },
      {
        "rank": 3,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.627
      },
      {
        "rank": 4,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 5.594
      },
      {
        "rank": 5,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.47
      },
      {
        "rank": 6,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.455
      },
      {
        "rank": 7,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.454
      },
      {
        "rank": 8,
        "name": "Katie Morris",
        "age": null,
        "rating": 5.375
      },
      {
        "rank": 9,
        "name": "Caroline Nothnagel",
        "age": null,
        "rating": 5.318
      },
      {
        "rank": 10,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.17
      },
      {
        "rank": 11,
        "name": "Alma Thell Lenntorp",
        "age": null,
        "rating": 5.168
      },
      {
        "rank": 12,
        "name": "Francesca  Rumi",
        "age": null,
        "rating": 5.101
      },
      {
        "rank": 13,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.065
      },
      {
        "rank": 14,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 5.043
      },
      {
        "rank": 15,
        "name": "Pialena Ander",
        "age": null,
        "rating": 5.01
      },
      {
        "rank": 16,
        "name": "Marina Alcaide",
        "age": null,
        "rating": 5.009
      },
      {
        "rank": 17,
        "name": "Marta Zajac",
        "age": null,
        "rating": 4.992
      },
      {
        "rank": 18,
        "name": "Isabelle Papazyan",
        "age": null,
        "rating": 4.957
      },
      {
        "rank": 19,
        "name": "Martina Frantova",
        "age": null,
        "rating": 4.951
      },
      {
        "rank": 20,
        "name": "Paula Rives Palau",
        "age": null,
        "rating": 4.882
      },
      {
        "rank": 21,
        "name": "Stephanie Scimone",
        "age": null,
        "rating": 4.845
      },
      {
        "rank": 22,
        "name": "Viktoria Kanichova",
        "age": null,
        "rating": 4.825
      },
      {
        "rank": 23,
        "name": "Sharienne Ricardo",
        "age": null,
        "rating": 4.818
      },
      {
        "rank": 24,
        "name": "Claudia Caymel",
        "age": null,
        "rating": 4.807
      },
      {
        "rank": 25,
        "name": "Rachel Mccrae",
        "age": null,
        "rating": 4.79
      }
    ]
  }
};


export const DUPR_SCOPES: { key: DuprScope; labelEn: string; labelVi: string; group: "global" | "continent" }[] = [
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
];

export const DUPR_LAST_UPDATED = "2026-05-11";
