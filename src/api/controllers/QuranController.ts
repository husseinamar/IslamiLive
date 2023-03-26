import 'reflect-metadata';
import { QuranService } from '../services/QuranService';
import { QuranChapter } from '../models/QuranChapter';
import { Service } from 'typedi';
import { Body, Get, JsonController, Param, Post, QueryParam, Req, Res } from 'routing-controllers';
import { instanceToPlain } from 'class-transformer';
import { CreateQuranChapterRequest } from './requests/Quran/CreateQuranChapterRequest';
import { FindQuranChapterRequest } from './requests/Quran/FindQuranChapterRequest';
import * as fs from 'fs';
import * as convert from 'xml-js';
import { QuranVerse } from '../models/QuranVerse';

import { readFile, writeFile } from 'fs/promises'
import * as path from 'path';
import puppeteer from 'puppeteer';
import ejs from 'ejs';

@Service()
@JsonController('/quran')
export class QuranController {
    quranService: QuranService;

    constructor() {
        this.quranService = new QuranService();
     }

    @Get('/ping')
    public async ping(
        @Res() response: any
    ): Promise<any> {
        const successResponse: any = {
            status: 1,
            message: 'Successfully pinged the server',
            data: 'Hello',
        };
        return response.status(200).send(successResponse);
    }

    @Get('/chapters')
    public async findAll(
        @QueryParam('limit') limit: number,
        @QueryParam('offset') offset: number,
        @QueryParam('keyword') keyword: string,
        @QueryParam('count') count: number | boolean,
        @QueryParam('order') order: string,
        @Res() response: any
    ): Promise<any> {
        const relation = ['verses'];
        const WhereConditions = [];
        const fields = [];

        const quranChapters = await this.quranService.listChapters(
            limit,
            offset,
            fields,
            relation,
            WhereConditions,
            keyword,
            count,
            order
        );

        const successResponse: any = {
            status: 1,
            message: 'Successfully got all quranChapters',
            data: instanceToPlain(quranChapters),
        };
        return response.status(200).send(successResponse);
    }

    @Get('/chapters/:id')
    public async findChapter(
        @Param('id') id: string,
        @Body() quranChapterParam: FindQuranChapterRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(`Looking for quranChapter { id: ${id} }`)
        const quranChapter = await this.quranService.findOneChapter({
            where: {
                id: id,
            },
            relations: ['verses'],
        });

        if ( !quranChapter ) {
            const errorResponse: any = {
                status: 0,
                message: 'Could not find a Quran Chapter with the provided id.',
                data: undefined,
            };
            return response.status(200).send(errorResponse);
        }

        const successResponse: any = {
            status: 1,
            message: 'Found Quran Chapter.',
            data: instanceToPlain(quranChapter),
        };
        return response.status(200).send(successResponse);
    }

    @Get('/chapters/:id/pdf')
    public async generateFullChapterPDF(
        @Param('id') id: string,
        @Body() quranChapterParam: FindQuranChapterRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(`Looking for quranChapter { id: ${id} }`)
        const quranChapter = await this.quranService.findOneChapter({
            where: {
                id: id,
            },
            relations: ['verses'],
        });

        if ( !quranChapter ) {
            const errorResponse: any = {
                status: 0,
                message: 'Could not find a Quran Chapter with the provided id.',
                data: undefined,
            };
            return response.status(200).send(errorResponse);
        }

        let hasBasmala = false;

        if ( quranChapter.verses.at(0).arabic === "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ" ) {
            hasBasmala = true;
        }

        const OUTFILE = path.join(__dirname, '../../..', 'public/generated/Quran/pdf/') + quranChapter.name;
        await this.createPDFPuppeteer(OUTFILE, {
            hasBasmala,
            slides: quranChapter.verses,
        });
        
        const successResponse: any = {
            status: 1,
            message: 'Found Quran Chapter.',
            data: instanceToPlain({ url: OUTFILE + '.pdf', quranChapter }),
        };
        return response.status(200).send(successResponse);
    }

    // TODO: take verses in the request too and add them
    @Post('/chapters')
    public async createQuranChapter(
        @Body({ validate: true }) createParam: CreateQuranChapterRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(createParam);

        // search by name
        let quranChapter = await this.quranService.findOneChapter({
            where: {
                name: createParam.name,
            }
        });

        // search by Quran chapter number (to make sure the name didn't simply have a typo)
        if ( !quranChapter ) {
            quranChapter = await this.quranService.findOneChapter({
                where: {
                    number: createParam.number,
                }
            });
        }

        if ( quranChapter ) {
            const errorResponse: any = {
                status: 0,
                message: 'Quran Chapter already exists.',
                data: quranChapter,
            };
            return response.status(200).send(errorResponse);
        }

        const newQuranChapter = new QuranChapter();
        newQuranChapter.name = createParam.name;

        const quranChapterSaveResponse = this.quranService.createChapter(newQuranChapter);

        if ( !quranChapterSaveResponse ) {
            const errorResponse: any = {
                status: 0,
                message: 'An error occured while saving the quranChapter. Parameters received are below',
                data: instanceToPlain(createParam),
            };
            return response.status(500).send(errorResponse);
        }

        const successResponse: any = {
            status: 1,
            message: 'Did not find a quranChapter with specified information. Created one.',
            data: instanceToPlain(newQuranChapter),
        };
        return response.status(200).send(successResponse);
    }

    /**
     * Imports all chapters and verses from the xml files
     * @param createParam 
     * @param response 
     * @returns 
     */
    @Post('/import-all')
    public async importAll(
        @Body() createParam: any,
        @Res() response: any
    ) {
        let quranChapters: QuranChapter;
        let quranVerse: QuranVerse;

        // look if there are chapters already
        // if there are entries already we have to delete them
        try {
            quranChapters = await this.quranService.findOneChapter({
            where: {
                    id: 1,
                },
            });
        } catch ( error ) {

        }

        // to prevent any doubles and/or inconsistensies don't accept create all request if table isn't empty
        if ( quranChapters ) {
            const errorResponse: any = {
                status: 0,
                message: 'Please delete previous entries first',
                data: {},
            };
            return response.status(500).send(errorResponse);
        }

        // look if there are chapters already
        // if there are entries already we have to delete them
        try {
            quranVerse = await this.quranService.findOneVerse({
            where: {
                    id: 1,
                },
            });
        } catch ( error ) {

        }

        // to prevent any doubles and/or inconsistensies don't accept create all request if table isn't empty
        if ( quranVerse ) {
            const errorResponse: any = {
                status: 0,
                message: 'Please delete previous entries first',
                data: {},
            };
            return response.status(500).send(errorResponse);
        }

        const arabicXML = fs.readFileSync('public/files/Quran/quran-uthmani.xml');
        const arabicJSON = await JSON.parse(convert.xml2json(arabicXML.toString(), {
            compact: true,
            spaces: 0,
            // ignoreComment: true,
        }));

        // add german strings to the Objects
        const germanXML = fs.readFileSync('public/files/Quran/de.khoury.xml');
        const germanJSON = await JSON.parse(convert.xml2json(germanXML.toString(), {
            compact: true,
            spaces: 0,
            // ignoreComment: true,
        }));

        // const quranKeys = Object.keys(germanJSON['quran']['sura']);

        const chapters: QuranChapter[] = [];
        for ( const sura of arabicJSON.quran.sura ) {
            
            if ( sura === undefined ) {
                break;
            }

            // create a new chapter object
            const newChapter = new QuranChapter();
            
            // set the index
            newChapter.number = sura._attributes.index;
            const germanSura = germanJSON.quran.sura[newChapter.number - 1];

            // set the name in German and Arabic
            newChapter.name = sura._attributes.name;
            newChapter.german = germanSura._attributes.name;
            
            // load the verses and save them
            const verses: QuranVerse[] = [];
            
            // get the verses of the chapters
            for ( const verse of sura.aya ) {
                const germanVerse = germanSura.aya[verse._attributes.index - 1];

                // create a new verse object
                const newVerse = new QuranVerse();
                
                // set the index
                newVerse.number = parseInt(verse._attributes.index);

                // set the german and arabic text of the verse
                newVerse.arabic = verse._attributes.text;
                newVerse.german = germanVerse._attributes.text;
                
                verses.push(newVerse);

                const saveResponse = await this.quranService.createVerse(newVerse);

                if ( !saveResponse ) {
                    const errorResponse: any = {
                        status: 0,
                        message: 'Failed to save a verse. Aborted.',
                        data: {
                            newVerse,
                            saveResponse
                        },
                    };
                    return response.status(500).send(errorResponse);
                }
            }
            
            newChapter.verses = verses;
            
            chapters.push(newChapter);
            const saveResponse = await this.quranService.createChapter(newChapter);

            if ( !saveResponse ) {
                const errorResponse: any = {
                    status: 0,
                    message: 'Failed to save a chapter. Aborted.',
                    data: {
                        newChapter,
                        saveResponse
                    },
                };
                return response.status(500).send(errorResponse);
            }
        }

        const successResponse: any = {
            status: 0,
            message: 'Created new list of chapter',
            data: instanceToPlain(chapters),
        };
        return response.status(500).send(successResponse);
    }

    @Get('/chapter-interval/:startChapterId/:startVerseId/:endChapterId/:endVerseId')
    public async loadVersesInterval(
        @Param('startChapterId') startChapterId: number,
        @Param('startVerseId') startVerseId: number,
        @Param('endChapterId') endChapterId: number,
        @Param('endVerseId') endVerseId: number,
        @Res() response: any
    ) {
        console.log({
            startChapterId,
            startVerseId,
            endChapterId,
            endVerseId,
        });

        const chapters: QuranChapter[] = [];
        for ( let i = startChapterId; i >= startChapterId && i <= endChapterId; i++ ) {
            const chapter = await this.quranService.findOneChapter({
                where: {
                    id: i,
                },
                relations: ['verses'],
            });

            if ( !chapter ) {
                const errorResponse: any = {
                    status: 0,
                    message: 'Could not find one of the specified chapters.',
                    data: {chapters},
                };
                return response.status(200).send(errorResponse);
            }

            const newChapter = new QuranChapter();
            const verses: QuranVerse[] = [];

            newChapter.number = chapter.number;
            newChapter.name = chapter.name;
            newChapter.german = chapter.german;

            if ( startChapterId === endChapterId ) {
                for (
                    let j = startVerseId - 1;
                    (j < chapter.verses.length) && (j < endVerseId);
                    j++ 
                ) {
                    const verse = chapter.verses.at(j);
                    verses.push(verse);
                }
            }

            if ( startChapterId !== endChapterId ) {
                let startValue = startVerseId - 1;
                
                if ( i !== startChapterId ) {
                    startValue = 0;
                }

                for ( let j = startValue; j < chapter.verses.length; j++ ) {
                    const verse = chapter.verses.at(j);
                    verses.push(verse);

                    // we reached where we wanted and added it, so stop
                    if ( i === endChapterId && j == endVerseId ) {
                        break;
                    }
                }
            }

            newChapter.verses = verses;
            chapters.push(newChapter);
        }

        const successResponse: any = {
            status: 0,
            message: 'Found interval.',
            data: {chapters},
        };
        return response.status(200).send(successResponse);
    }

    private async createPDFPuppeteer(output: string, content: any): Promise<any> {
        console.log('[createPDFPuppeteer]', 'started converting to PDF');

        const assets = {
            background: {
                src: ('../files/Templates/1/dark/Hintergrund.png'),
                width: 1920,
                height: 1080,
            },
            backgroundLight: {
                src: ('../files/Templates/1/light/Hintergrund.png'),
                width: 1920,
                height: 1080,
            },
            ribbon: {
                src: ('../files/Templates/1/dark/ribbon.png'),
                width: 1921,
                height: 130,
            },
            lantern: {
                src: ('../files/Templates/1/dark/lantern.png'),
                width: 170,
                height: 438,
            },
            image: {
                src: ('../files/Templates/1/dark/image.png'),
                width: 502,
                height: 559,
            },
        };

        const browser = await puppeteer.launch({
            headless: true,
            defaultViewport: {
                width: 1920,
                height: 1080,
            },
            args: ['--allow-file-access-from-files', '--enable-local-file-accesses']
        });
    
        await ejs.renderFile(path.join(__dirname, '../../..', 'views/Quran/slide.ejs'), {assets, content}, async (err: any, data: any) => {
            const page = await browser.newPage();
            // const file = 'public/pages/slide.html';
            const file = path.join(__dirname, '../../..', 'public') + '/pages/slide.html';
            console.log('file://' + path.join(__dirname, '../../..', 'public') + '/pages/slide.html');
            await writeFile(file, data);
            await page.goto('file://' + path.join(__dirname, '../../..', 'public') + '/pages/slide.html');
            // await page.setContent(data);
    
            await page.pdf({
                omitBackground: true,
                width: 1920,
                height: 1080,
                margin: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                },
                path: output + '.pdf',
                printBackground: true,
            });
    
            console.log('[createPDFPuppeteer]', "done");
            await browser.close();
        });
    
    }
    
}