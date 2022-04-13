// import 'reflect-metadata';
// import { DuaChapterService } from '../services/DuaChapterService';
// import { DuaVerseService } from '../services/DuaVerseService';
// import { DuaChapter } from '../../api/models/DuaChapter';
// import { Service } from 'typedi';
// import { Body, Get, JsonController, Param, Post, QueryParam, Req, Res } from 'routing-controllers';
// import { instanceToPlain } from 'class-transformer';
// import { CreateDuaChapterRequest } from './requests/Dua/CreateDuaChapterRequest';
// import { FindDuaChapterRequest } from './requests/Dua/FindDuaChapterRequest';
// import * as fs from 'fs';
// import * as convert from 'xml-js';
// import { DuaVerse } from '../models/DuaVerse';

// @Service()
// @JsonController('/dua')
// export class DuaController {
//     duaChapterService: DuaChapterService;
//     duaVerseService: DuaVerseService;

//     constructor() {
//         this.duaChapterService = new DuaChapterService();
//         this.duaVerseService = new DuaVerseService();
//      }

//     @Get('/ping')
//     public async ping(
//         @Res() response: any
//     ): Promise<any> {
//         const successResponse: any = {
//             status: 1,
//             message: 'Successfully pinged the server',
//             data: 'Hello',
//         };
//         return response.status(200).send(successResponse);
//     }

//     @Get('/chapter/list')
//     public async findAll(
//         @QueryParam('limit') limit: number,
//         @QueryParam('offset') offset: number,
//         @QueryParam('keyword') keyword: string,
//         @QueryParam('count') count: number | boolean,
//         @QueryParam('order') order: string,
//         @Res() response: any
//     ): Promise<any> {
//         const relation = ['verses'];
//         const WhereConditions = [];
//         const fields = [];

//         const duaChapters = await this.duaChapterService.list(
//             limit,
//             offset,
//             fields,
//             relation,
//             WhereConditions,
//             keyword,
//             count,
//             order
//         );

//         const successResponse: any = {
//             status: 1,
//             message: 'Successfully got all duaChapters',
//             data: instanceToPlain(duaChapters),
//         };
//         return response.status(200).send(successResponse);
//     }

//     @Get('/chapter/:id')
//     public async find(
//         @Param('id') id: string,
//         @Body() duaChapterParam: FindDuaChapterRequest,
//         @Res() response: any
//     ): Promise<any> {
//         console.log(`Looking for duaChapter { id: ${id} }`)
//         const duaChapter = await this.duaChapterService.findOne({
//             where: {
//                 id: id,
//             },
//             relations: ['verses'],
//         });

//         if ( !duaChapter ) {
//             const errorResponse: any = {
//                 status: 0,
//                 message: 'Could not find a Dua Chapter with the provided id.',
//                 data: undefined,
//             };
//             return response.status(200).send(errorResponse);
//         }

//         const successResponse: any = {
//             status: 1,
//             message: 'Found Dua Chapter.',
//             data: instanceToPlain(duaChapter),
//         };
//         return response.status(200).send(successResponse);
//     }

//     @Post('/create-chapter')
//     public async createDuaChapter(
//         @Body({ validate: true }) createParam: CreateDuaChapterRequest,
//         @Res() response: any
//     ): Promise<any> {
//         console.log(createParam);

//         let duaChapter = await this.duaChapterService.findOne({
//             where: {
//                 name: createParam.name,
//             }
//         });

//         if ( !duaChapter ) {
//             duaChapter = await this.duaChapterService.findOne({
//                 where: {
//                     number: createParam.number,
//                 }
//             });
//         }

//         if ( duaChapter ) {
//             const errorResponse: any = {
//                 status: 0,
//                 message: 'Dua Chapter already exists.',
//                 data: duaChapter,
//             };
//             return response.status(200).send(errorResponse);
//         }

//         const newDuaChapter = new DuaChapter();
//         newDuaChapter.name = createParam.name;

//         const duaChapterSaveResponse = this.duaChapterService.create(newDuaChapter);

//         if ( !duaChapterSaveResponse ) {
//             const errorResponse: any = {
//                 status: 0,
//                 message: 'An error occured while saving the duaChapter. Parameters received are below',
//                 data: instanceToPlain(createParam),
//             };
//             return response.status(500).send(errorResponse);
//         }

//         const successResponse: any = {
//             status: 1,
//             message: 'Did not find a duaChapter with specified information. Created one.',
//             data: instanceToPlain(newDuaChapter),
//         };
//         return response.status(200).send(successResponse);
//     }

//     @Get('/create-all')
//     public async createAll(
//         @Body() createParam: any,
//         @Res() response: any
//     ) {
//         let duaChapters: DuaChapter;

//         try {
//             duaChapters = await this.duaChapterService.findOne({
//             where: {
//                     id: 1,
//                 },
//             });
//         } catch ( error ) {

//         }

//         // to prevent any doubles and/or inconsistensies don't accept create all request if table isn't empty
//         if ( duaChapters ) {
//             const errorResponse: any = {
//                 status: 0,
//                 message: 'Please delete previous entries first',
//                 data: {},
//             };
//             return response.status(500).send(errorResponse);
//         }

//         const arabicXML = fs.readFileSync('public/files/Dua/dua-uthmani.xml');
//         const arabicJSON = await JSON.parse(convert.xml2json(arabicXML.toString(), {
//             compact: true,
//             spaces: 0,
//             // ignoreComment: true,
//         }));

//         // add german strings to the Objects
//         const germanXML = fs.readFileSync('public/files/Dua/de.khoury.xml');
//         const germanJSON = await JSON.parse(convert.xml2json(germanXML.toString(), {
//             compact: true,
//             spaces: 0,
//             // ignoreComment: true,
//         }));

//         // const duaKeys = Object.keys(germanJSON['dua']['sura']);

//         const chapters: DuaChapter[] = [];
//         for ( const sura of arabicJSON.dua.sura ) {
            
//             if ( sura === undefined ) {
//                 break;
//             }

//             // create a new chapter object
//             const newChapter = new DuaChapter();
            
//             // set the index
//             newChapter.number = sura._attributes.index;
//             const germanSura = germanJSON.dua.sura[newChapter.number - 1];

//             // set the name in German and Arabic
//             newChapter.name = sura._attributes.name;
//             newChapter.german = germanSura._attributes.name;
            
//             // load the verses and save them
//             const verses: DuaVerse[] = [];
            
//             // get the verses of the chapters
//             for ( const verse of sura.aya ) {
//                 const germanVerse = germanSura.aya[verse._attributes.index - 1];

//                 // create a new verse object
//                 const newVerse = new DuaVerse();
                
//                 // set the index
//                 newVerse.number = parseInt(verse._attributes.index);

//                 // set the german and arabic text of the verse
//                 newVerse.arabic = verse._attributes.text;
//                 newVerse.german = germanVerse._attributes.text;
                
//                 verses.push(newVerse);

//                 const saveResponse = await this.duaVerseService.create(newVerse);

//                 if ( !saveResponse ) {
//                     const errorResponse: any = {
//                         status: 0,
//                         message: 'Failed to save a verse. Aborted.',
//                         data: {
//                             newVerse,
//                             saveResponse
//                         },
//                     };
//                     return response.status(500).send(errorResponse);
//                 }
//             }
            
//             newChapter.verses = verses;
            
//             chapters.push(newChapter);
//             const saveResponse = await this.duaChapterService.create(newChapter);

//             if ( !saveResponse ) {
//                 const errorResponse: any = {
//                     status: 0,
//                     message: 'Failed to save a chapter. Aborted.',
//                     data: {
//                         newChapter,
//                         saveResponse
//                     },
//                 };
//                 return response.status(500).send(errorResponse);
//             }
//         }

//         const successResponse: any = {
//             status: 0,
//             message: 'Created new list of chapter',
//             data: instanceToPlain(chapters),
//         };
//         return response.status(500).send(successResponse);
//     }

//     @Get('/chapter-interval/:startChapterId/:startVerseId/:endChapterId/:endVerseId')
//     public async loadVersesInterval(
//         @Param('startChapterId') startChapterId: number,
//         @Param('startVerseId') startVerseId: number,
//         @Param('endChapterId') endChapterId: number,
//         @Param('endVerseId') endVerseId: number,
//         @Res() response: any
//     ) {
//         console.log({
//             startChapterId,
//             startVerseId,
//             endChapterId,
//             endVerseId,
//         });

//         const chapters: DuaChapter[] = [];
//         for ( let i = startChapterId; i >= startChapterId && i <= endChapterId; i++ ) {
//             const chapter = await this.duaChapterService.findOne({
//                 where: {
//                     id: i,
//                 },
//                 relations: ['verses'],
//             });

//             if ( !chapter ) {
//                 const errorResponse: any = {
//                     status: 0,
//                     message: 'Could not find one of the specified chapters.',
//                     data: {chapters},
//                 };
//                 return response.status(200).send(errorResponse);
//             }

//             const newChapter = new DuaChapter();
//             const verses: DuaVerse[] = [];

//             newChapter.number = chapter.number;
//             newChapter.name = chapter.name;
//             newChapter.german = chapter.german;

//             if ( startChapterId === endChapterId ) {
//                 for (
//                     let j = startVerseId - 1;
//                     (j < chapter.verses.length) && (j < endVerseId);
//                     j++ 
//                 ) {
//                     const verse = chapter.verses.at(j);
//                     verses.push(verse);
//                 }
//             }

//             if ( startChapterId !== endChapterId ) {
//                 let startValue = startVerseId - 1;
                
//                 if ( i !== startChapterId ) {
//                     startValue = 0;
//                 }

//                 for ( let j = startValue; j < chapter.verses.length; j++ ) {
//                     const verse = chapter.verses.at(j);
//                     verses.push(verse);

//                     // we reached where we wanted and added it, so stop
//                     if ( i === endChapterId && j == endVerseId ) {
//                         break;
//                     }
//                 }
//             }

//             newChapter.verses = verses;
//             chapters.push(newChapter);
//         }

//         const successResponse: any = {
//             status: 0,
//             message: 'Found interval.',
//             data: {chapters},
//         };
//         return response.status(200).send(successResponse);
//     }
// }