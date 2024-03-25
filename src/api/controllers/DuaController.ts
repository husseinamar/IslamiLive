import 'reflect-metadata';
import { DuaService } from '../services/DuaService';
import { DuaChapter } from '../models/DuaChapter';
import { Service } from 'typedi';
import { Body, Delete, Get, JsonController, Param, Post, Put, QueryParam, Req, Res } from 'routing-controllers';
import { instanceToPlain } from 'class-transformer';
import { CreateDuaChapterRequest } from './requests/Dua/CreateDuaChapterRequest';
import { DuaChapterToPDFRequest } from './requests/Dua/FindDuaChapterRequest';
import { ReadXMLFileRequest } from './requests/Dua/ReadXMLFileRequest';
import { ImportDuaFromArrayRequest } from './requests/Dua/ImportDuaFromArrayRequest';
import { JSDOM } from 'jsdom';
import { DuaVerse } from '../models/DuaVerse';
import * as path from 'path';
import { Response } from 'express';

import { readFile, writeFile } from 'fs/promises'
import puppeteer, { Browser } from 'puppeteer';
import ejs from 'ejs';
import { ImportDuaFromJSONFileRequest } from './requests/Dua/ImportDuaFromJSONFileRequest';
import { DuaJSON } from '../models/DuaJSON';
import { env } from '../../env';
import { sleep } from '../utils/utils';

@Service()
@JsonController('/dua')
export class DuaController {
    duaService: DuaService;

    constructor() {
        this.duaService = new DuaService();
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

    @Get('/chapters/')
    public async findAllChapters(
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

        const duaChapters = await this.duaService.listChapters(
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
            message: 'Successfully got all duaChapters',
            data: instanceToPlain(duaChapters),
        };
        return response.status(200).send(successResponse);
    }

    @Post('/chapters')
    public async createDuaChapter(
        @Body({ validate: true }) createParam: CreateDuaChapterRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(createParam);

        let duaChapter = await this.duaService.findOneChapter({
            where: {
                name: createParam.name,
            }
        });

        if ( !duaChapter ) {
            duaChapter = await this.duaService.findOneChapter({
                where: {
                    number: createParam.number,
                }
            });
        }

        if ( duaChapter ) {
            const errorResponse: any = {
                status: 0,
                message: 'Dua Chapter already exists.',
                data: duaChapter,
            };
            return response.status(200).send(errorResponse);
        }

        const newDuaChapter = new DuaChapter();
        newDuaChapter.name = createParam.name;

        const duaChapterSaveResponse = this.duaService.createChapter(newDuaChapter);

        // TODO: take verses in the request too and add them

        if ( !duaChapterSaveResponse ) {
            const errorResponse: any = {
                status: 0,
                message: 'An error occured while saving the duaChapter. Parameters received are below',
                data: instanceToPlain(createParam),
            };
            return response.status(500).send(errorResponse);
        }

        const successResponse: any = {
            status: 1,
            message: 'Did not find a duaChapter with specified information. Created one.',
            data: instanceToPlain(newDuaChapter),
        };
        return response.status(200).send(successResponse);
    }

    @Get('/chapters/xml')
    public async readXML(
        @Body() createParam: ReadXMLFileRequest,
        @Res() response: any
    ) {
        let duaChapters: DuaChapter;
        let duaVerse: DuaVerse;

        console.log(createParam);
        
        // const dom = await JSDOM.fromFile(path.join(__dirname, '../../..', 'public/files/Bittgebete/test/Duaa iftitah fertig ohne Titel.xml'));
        const dom = await JSDOM.fromFile(createParam.filePath);
        const document = dom.window.document;
        
        const pkgParts = document.getElementsByTagName("pkg:part");
        let numSlidesRead = 0;
        let allSlideObjects = {};
        let texts = [];

        for (var i = 0; i < pkgParts.length; i++) {
            // make sure that the current package part is a slide
            if ( pkgParts[i].getAttribute("pkg:name").includes("/ppt/slides/slide") ) {
                // select the slide
                const slide = pkgParts[i];
                const slideNumber = parseInt(pkgParts[i].getAttribute("pkg:name").replace('/ppt/slides/slide', '').replace('.xml', ''));
                const slideObject = {};

                // get all text boxes in the slide
                const textBoxes = slide.getElementsByTagName("p:sp");

                // make sure there are text boxes
                if ( textBoxes.length <= 0 ) {
                    continue;
                }

                try {
                    // get the text inside every textbox of the slide
                    for ( let j = 0; j < textBoxes.length; j++ ) {
                        const textBox = textBoxes[j];
                        let text = '';
                        
                        // get the text box body
                        const textBoxContent = textBox.getElementsByTagName("p:txBody")[0];
            
                        // get the text lines in the text box
                        const textLines = textBoxContent.getElementsByTagName("a:p");

                        // make sure that text box has lines of text
                        if ( textLines.length <= 0 ) {
                            continue;
                        }

                        // append new lines in the same box to the same text variable
                        for ( let k = 0; k < textLines.length; k++ ) {
                            const line = textLines[k];
                            let lineContent = line.getElementsByTagName("a:r");
                            if (lineContent.length > 0) {
                                for ( let l = 0; l < lineContent.length; l++ ) {
                                    text += lineContent[l].getElementsByTagName("a:t")[0].childNodes[0].nodeValue;
                                    text = text.replace('  ', ' ');
                                }
                                
                                text = text.trim() + ' ';
                                
                                const symbols = ['\,', '\.', '\؟', '\:', '\!', '\،'];
                                
                                for ( let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex++ ) {
                                    const symbol = symbols[symbolIndex];
                                    text = text.replace(' ' + symbol, symbol);
                                }
                                
                            } else {
                                continue;
                            }
                        }
                        
                        slideObject['text_' + j] = text;
                    }
                }

                // log errors
                catch(error) {
                    console.log(error);
                    break;
                }

                slideObject['slide'] = slideNumber;
                allSlideObjects[slideNumber] = slideObject;
                numSlidesRead++;
            }
        }

        const slideObjectsKeys = Object.keys(allSlideObjects);
        slideObjectsKeys.sort((a: any, b: any) => a - b);

        const slides = [];
        for ( let i = 0; i < slideObjectsKeys.length; i++ ) {
            const key = slideObjectsKeys[i];
            slides.push(allSlideObjects[key]);
        }

        const successResponse: any = {
            status: 0,
            message: 'Created new list of chapter',
            data: instanceToPlain(slides),
        };
        return response.status(200).send(successResponse);
    }

    @Put('/chapters/array')
    public async importFromArray(
        @Body() createParam: ImportDuaFromArrayRequest,
        @Res() response: any
    ) {
        let duaChapter = await this.duaService.findOneChapter({
            where: {
                name: createParam.name,
            },
        });
        
        if ( duaChapter && createParam.shouldAppend === false ) {
            const errorResponse: any = {
                status: 0,
                message: 'Could not import dua because it already exists in db',
                data: instanceToPlain(duaChapter),
            };
            return response.status(400).send(errorResponse);
        }

        let newChapter: DuaChapter = new DuaChapter();
        newChapter.name = createParam.name;
        newChapter.german = createParam.germanName;

        if ( duaChapter && createParam.shouldAppend ) {
            newChapter = ( duaChapter && createParam.shouldAppend ) ? duaChapter: new DuaChapter();
            newChapter.name = duaChapter.name;
            newChapter.german = duaChapter.german;
            newChapter.verses = duaChapter.verses;
        }

        const lines: DuaVerse[] = (newChapter.verses?.length > 0) ? newChapter.verses : [];
        let lineNumber = (newChapter.verses?.length > 0) ? newChapter.verses.length + 1 : 1;
        for ( const line of createParam.lines ) {
            let german = "";
            let arabic = "";
            let transliteration = "";

            if ( line[createParam.germanTextIdentifier] ) {
                german = line[createParam.germanTextIdentifier];
            }

            if ( line[createParam.arabicTextIdentifier] ) {
                arabic = line[createParam.arabicTextIdentifier];
            }

            if ( line[createParam.transliterationTextIdentifier] ) {
                transliteration = line[createParam.transliterationTextIdentifier];
            }

            const newVerse = new DuaVerse();
            newVerse.arabic = arabic;
            newVerse.german = german;
            newVerse.transliteration = transliteration;
            newVerse.number = lineNumber;
            // newVerse.chapter = duaChapter;
            lines.push(newVerse);

            const saveResponse = await this.duaService.createVerse(newVerse);

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

            lineNumber++;
        }

        newChapter.verses = lines;

        const saveResponse = await this.duaService.createChapter(newChapter);

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

        this.duaService.writeDuaChapterToJsonFile(saveResponse);

        const successResponse: any = {
            status: 0,
            message: 'Created new chapter',
            data: instanceToPlain(newChapter),
        };
        return response.status(200).send(successResponse);
    }

    @Get('/import-from-json-file')
    public async importFromJSON(
        @Body() createParam: ImportDuaFromJSONFileRequest,
        @Res() response: any
    ) {

        const file = await readFile(createParam.file);
        const json: DuaJSON = new DuaJSON(JSON.parse(file.toString()));

        let duaChapter = await this.duaService.findOneChapter({
            where: {
                name: json.name,
            },
        });
        
        if ( duaChapter ) {
            const errorResponse: any = {
                status: 0,
                message: 'Could not import dua because it already exists in db',
                data: instanceToPlain(duaChapter),
            };
            return response.status(400).send(errorResponse);
        }

        const newChapter = new DuaChapter();
        newChapter.name = json.name;
        newChapter.german = json.germanName;

        const lines: DuaVerse[] = [];
        let lineNumber = 1;
        for ( let i = 0; i < json.lines.length; i++ ) {
            const line = json.lines[i];
            let german = "";
            let arabic = "";
            let transliteration = "";

            if ( line[json.germanTextIdentifier] ) {
                german = line[json.germanTextIdentifier];
            }

            if ( line[json.arabicTextIdentifier] ) {
                arabic = line[json.arabicTextIdentifier];
            }

            if ( line[json.transliterationTextIdentifier] ) {
                transliteration = line[json.transliterationTextIdentifier];
            }

            const newVerse = new DuaVerse();
            newVerse.arabic = arabic;
            newVerse.german = german;
            newVerse.transliteration = transliteration;
            newVerse.number = lineNumber;
            // newVerse.chapter = duaChapter;
            lines.push(newVerse);

            const saveResponse = await this.duaService.createVerse(newVerse);

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

            lineNumber++;
        }

        newChapter.verses = lines;

        const saveResponse = await this.duaService.createChapter(newChapter);

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

        const successResponse: any = {
            status: 0,
            message: 'Created new chapter',
            data: instanceToPlain(newChapter),
        };
        return response.status(200).send(successResponse);
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

        const chapters: DuaChapter[] = [];
        for ( let i = startChapterId; i >= startChapterId && i <= endChapterId; i++ ) {
            const chapter = await this.duaService.findOneChapter({
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

            const newChapter = new DuaChapter();
            const verses: DuaVerse[] = [];

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

    @Get('/chapters/:id')
    public async findChapter(
        @Param('id') id: string,
        @Res() response: any
    ): Promise<any> {
        console.log(`Looking for duaChapter { id: ${id} }`)
        const duaChapter = await this.duaService.findOneChapter({
            where: {
                id: id,
            },
            relations: ['verses'],
        });

        if ( !duaChapter ) {
            const errorResponse: any = {
                status: 0,
                message: 'Could not find a Dua Chapter with the provided id.',
                data: undefined,
            };
            return response.status(200).send(errorResponse);
        }

        const successResponse: any = {
            status: 1,
            message: 'Found Dua Chapter.',
            data: instanceToPlain(duaChapter),
        };
        return response.status(200).send(successResponse);
    }

    @Delete('/chapters/:id')
    public async removeChapter(
        @Param('id') id: string,
        @Res() response: any
    ) {
        const duaChapter = await this.duaService.findOneChapter({
            where: {
                id,
            },
            relations: ['verses'],
        });

        // make sure the specified chapter exists
        if ( !duaChapter ) {
            const errorResponse = {
                status: 0,
                message: 'Could not find the specified Dua',
                data: undefined,
            };
            return response.status(400).send(errorResponse);
        }

        // delete all the verses related to the chapter first
        const deletedVerses = [];
        for ( let i = 0; i < duaChapter.verses.length; i++ ) {
            const verse = duaChapter.verses[i];
            const verseDeleteResponse = await this.duaService.deleteVerse(verse.id);
            
            // make sure the verse was deleted
            if ( !verseDeleteResponse ) {
                const errorResponse = {
                    status: 0,
                    message: 'Failed to delete the dua verse',
                    data: instanceToPlain({
                        chapterToDelete: duaChapter.id,
                        failedToDelete: verse,
                    }),
                };
                return response.status(400).send(errorResponse);
            }
            
            // add the currently deleted verse to the list of deleted verses
            deletedVerses.push(verseDeleteResponse);
        }

        // delete the chapter
        const deleteResponse = await this.duaService.deleteChapter(duaChapter.id);

        // make sure the chapter was deleted
        if ( !deleteResponse ) {
            const errorResponse = {
                status: 0,
                message: 'Failed to delete the dua chapter',
                data: undefined,
            };
            return response.status(400).send(errorResponse);
        }

        const successResponse = {
            status: 0,
            message: 'Successfully deleted the chapter',
            data: instanceToPlain({
                chapter: deleteResponse,
                verses: deletedVerses,
            }),
        };
        return response.status(400).send(successResponse);
    }

    @Post('/chapters/jawschan/pdf')
    public async generateDuaJawschanPDF(
        @Body() duaChapterParam: DuaChapterToPDFRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(`Looking for duaChapter { id: jawschan }`)
        
        /*
        const duaChapter = {
            name: 'دعاء الجوشن الكبير',
            verses: [
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَللهُ يا رَحْمنُ يا رَحيمُ يا كَريمُ يا مُقيمُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Allah, o Gnädiger, o Erbarmer, o Großzügiger,",
                    slideNumber: "1"
                },
                {
                    arabic: "يا عَظيمُ يا قَديمُ يا عَليمُ يا حَليمُ يا حَكيمُ",
                    german: "o Aufrechterhalter, o Herrlicher, o Anfangsloser, o Wissender, o Sanftmütiger, o Weiser.",
                    slideNumber: "1"
                },
                {
                    arabic: "يا سَيِّدَ السّاداتِ يا مُجيبَ الدَّعَواتِ يا رافِعَ الدَّرَجاتِ",
                    german: "o Fürst der Fürsten, o Erhörender der Gebete, o Ehrhöher des Ranges,",
                    slideNumber: "2"
                },
                {
                    arabic: "يا وَلِيَّ الْحَسَناتِ يا غافِرَ الْخَطيئاتِ يا مُعْطِيَ الْمَسْأَلاتِ",
                    german: "o Statthalter der guten Dinge, o Vergebender der Fehler, o Erfüllender der Wünsche,",
                    slideNumber: "2"
                },
                {
                    arabic: "يا قابِلَ التَّوْباتِ يا سامِعَ الأصْواتِ يا عالِمَ الْخَفِيّاتِ يا دافِعَ الْبَلِيَّاتِ",
                    german: "o Annehmer der Reue, o Hörender der Stimmen, o Wissender des Verborgenen, o Fernhalter des Unheils",
                    slideNumber: "2"
                },
                {
                    arabic: "يا خَيْرَ الْغافِرينَ يا خَيْرَ الْفاتِحينَ يا خَيْرَ النّاصِرينَ يا خَيْرَ الْحاكِمينَ يا خَيْرَ الرّازِقينَ",
                    german: "o Segenreichster der Vergeber, o Segenreichster der Eroberer, o Segenreichster der Helfer, o Segenreichster der Regierenden, o Segenreichster der Ernährer,",
                    slideNumber: "3"
                },
                {
                    arabic: "يا خَيْرَ الْوارِثينَ يا خَيْرَ الْحامِدينَ يا خَيْرَ الذّاكِرينَ يا خَيْرَ الْمُنْزِلينَ يا خَيْرَ الْمحْسِنينَ",
                    german: "o Segenreichster der Erben, o Segenreichster der Lobenden, o Segenreichster der Preisenden, o Segenreichster der Herabsendenden, o Segenreichster der Wohltäter.",
                    slideNumber: "3"
                },
            ],
        }
        */

        /*
        const duaChapter = {
            name: 'دعاء الجوشن الكبير',
            verses: [
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَللهُ يا رَحْمنُ يا رَحيمُ يا كَريمُ يا مُقيمُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Allah, o Gnädiger, o Erbarmer, o Großzügiger,",
                    slideNumber: "1"
                },
                {
                    arabic: "يا عَظيمُ يا قَديمُ يا عَليمُ يا حَليمُ يا حَكيمُ",
                    german: "o Aufrechterhalter, o Herrlicher, o Anfangsloser, o Wissender, o Sanftmütiger, o Weiser.",
                    slideNumber: "1"
                },
                {
                    arabic: "يا سَيِّدَ السّاداتِ يا مُجيبَ الدَّعَواتِ يا رافِعَ الدَّرَجاتِ",
                    german: "o Fürst der Fürsten, o Erhörender der Gebete, o Ehrhöher des Ranges,",
                    slideNumber: "2"
                },
                {
                    arabic: "يا وَلِيَّ الْحَسَناتِ يا غافِرَ الْخَطيئاتِ يا مُعْطِيَ الْمَسْأَلاتِ",
                    german: "o Statthalter der guten Dinge, o Vergebender der Fehler, o Erfüllender der Wünsche,",
                    slideNumber: "2"
                },
                {
                    arabic: "يا قابِلَ التَّوْباتِ يا سامِعَ الأصْواتِ يا عالِمَ الْخَفِيّاتِ يا دافِعَ الْبَلِيَّاتِ",
                    german: "o Annehmer der Reue, o Hörender der Stimmen, o Wissender des Verborgenen, o Fernhalter des Unheils",
                    slideNumber: "2"
                },
                {
                    arabic: "يا خَيْرَ الْغافِرينَ يا خَيْرَ الْفاتِحينَ يا خَيْرَ النّاصِرينَ يا خَيْرَ الْحاكِمينَ يا خَيْرَ الرّازِقينَ",
                    german: "o Segenreichster der Vergeber, o Segenreichster der Eroberer, o Segenreichster der Helfer, o Segenreichster der Regierenden, o Segenreichster der Ernährer,",
                    slideNumber: "3"
                },
                {
                    arabic: "يا خَيْرَ الْوارِثينَ يا خَيْرَ الْحامِدينَ يا خَيْرَ الذّاكِرينَ يا خَيْرَ الْمُنْزِلينَ يا خَيْرَ الْمحْسِنينَ",
                    german: "o Segenreichster der Erben, o Segenreichster der Lobenden, o Segenreichster der Preisenden, o Segenreichster der Herabsendenden, o Segenreichster der Wohltäter.",
                    slideNumber: "3"
                },
                {
                    arabic: "يا مَنْ لَهُ الْعِزَّةُ وَالْجَمالُ يا مَنْ لَهُ الْقُدْرَةُ وَالْكَمالُ",
                    german: "o Jener, Der die Erhabenheit und die Schönheit ist, o Jener, Der die Allmacht und die Vollkommenheit ist,",
                    slideNumber: "4"
                },
                {
                    arabic: "يا مَنْ لَهُ الْمُلْكُ وَالْجَلالُ يا مَنْ هُوَ الْكَبيرُ الْمُتَعالُ",
                    german: "o Jener, Der die Herrschaft und die Pracht ist, o Jener, Der groß und erhaben ist,",
                    slideNumber: "4"
                },
                {
                    arabic: "يا مُنْشِىءَ الْسَّحابِ الثِّقالِ يا مَنْ هُوَ شَديدُ الْمحالِ",
                    german: "o Jener, Der die schweren Wolken erschafft, o Jener, Der unermesslich stark ist,",
                    slideNumber: "4"
                },
                {
                    arabic: "يا مَنْ هُوَ سَريعُ الْحِسابِ يا مَنْ هُوَ شَديدُ الْعِقابِ",
                    german: "o Jener, Der schnell richtet, o Jener, Der streng bestraft,",
                    slideNumber: "4"
                },
                {
                    arabic: "يا مَنْ عِنْدَهُ حُسْنُ الثَّوابِ يا مَنْ عِنْدَهُ اُمُّ الْكِتابِ",
                    german: "o Jener, bei Dem sich die schönste Belohnung befindet, o Jener, bei Dem sich die Mutter des Buches befindet.",
                    slideNumber: "4"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا حَنّانُ يا مَنّانُ يا دَيّانُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Gnädiger, o Großzügiger, o gerecht Richtender",
                    slideNumber: "5"
                },
                {
                    arabic: "يا بُرْهانُ يا سُلْطانُ يا رِضْوانُ يا غُفْرانُ يا سُبْحانُ يا مُسْتَعانُ يا ذَا الْمَنِّ وَالْبَيانِ",
                    german: "o Beweis, o Herrscher, o Zufriedensteller, o Vergebender, o Gepriesener, o um Hilfe Gebetener, o Eigner der Gunst und der Beredsamkeit.",
                    slideNumber: "5"
                },
                {
                    arabic: "يا مَنْ تَواضَعَ كُلُّ شَيْءٍ لِعَظَمَتِهِ يا مَنِ اسْتَسْلَمَ كُلُّ شَيْءٍ لِقُدْرَتِهِ",
                    german: "o Jener, dessen Größe sich alles unterwirft, o Jener, dessen Allmacht sich alles unterordnet",
                    slideNumber: "6"
                },
                {
                    arabic: "يا مَنْ ذَلَّ كُلُّ شَيْءٍ لِعِزَّتِهِ يا مَنْ خَضَعَ كُلُّ شَيْءٍ لِهَيْبَتِهِ",
                    german: "o Jener, vor Dessen Ehre sich alles erniedrigt, o Jener, Dessen Würde alles Folge leistet",
                    slideNumber: "6"
                },
                {
                    arabic: "يا مَنِ انْقادَ كُلُّ شَيْءٍ مِنْ خَشْيَتِهِ يا مَنْ تَشَقَّقَتِ الْجِبالُ مِنْ مَخافَتِهِ",
                    german: "o Jener, Dessen Herrschaft sich alles fügt, o Jener, aus Furcht vor dem sich alles beugt",
                    slideNumber: "6"
                },
                {
                    arabic: "يا مَنْ قامَتِ السَّماواتُ بِاَمْرِهِ يا مَنِ اسْتَقَرَّتِ الاْرَضُونَ بِاِذْنِهِ",
                    german: "o Jener, aus Furcht vor dem sich die Berge spalten, o Jener Dessen Befehl die Himmel aufrecht erhält",
                    slideNumber: "6"
                },
                {
                    arabic: "يا مَنْ يُسَبِّحُ الرَّعْدُ بِحَمْدِهِ يا مَنْ لا يَعْتَدي عَلى اَهْلِ مَمْلَكَتِهِ",
                    german: "o Jener, mit Dessen Erlaubnis die Erde von Bestand ist, o Jener, der Du nicht ungerecht gegen die Bewohner des Königreichs handelst",
                    slideNumber: "6"
                },
                {
                    arabic: "يا غافِرَ الْخَطايا يا كاشِفَ الْبَلايا يا مُنْتَهَى الرَّجايا يا مُجْزِلَ الْعَطايا",
                    german: "o Verzeihender der Fehler, o Beseitigender des Unheils, o letzte Instanz der Hoffnungen, o reichlich Schenkender der Gaben,",
                    slideNumber: "7"
                },
                {
                    arabic: "يا واهِبَ الْهَدايا يا رازِقَ الْبَرايا",
                    german: "o Gewährer der Geschenke, o Ernährer der Geschöpfe,",
                    slideNumber: "7"
                },
                {
                    arabic: "يا قاضِيَ الْمَنايا يا سامِعَ الشَّكايا يا باعِثَ الْبَرايا يا مُطْلِقَ الأُسارى",
                    german: "o Richter über die Geschicke, o Erhörender der Klagen, o die Geschöpfe zum Leben Erweckender, o Befreier der Gefangenen.",
                    slideNumber: "7"
                },
                {
                    arabic: "يا ذَا الْحَمْدِ وَالثَّناءِ يا ذَا الْفَخْرِ وَاْلبَهاءِ يا ذَا الْمجْدِ وَالسَّناءِ يا ذَا الْعَهْدِ وَالْوَفاءِ",
                    german: "o Eigentümer des Lobes und des Preises, o Eigentümer des Ruhmes und des Glanzes, o Eigentümer der Ehre und der Erhabenheit, o Eigentümer des Vertrags und seiner Einhaltung",
                    slideNumber: "8"
                },
                {
                    arabic: "يا ذَا الْعَفْوِ وَالرِّضاءِ يا ذَا الْمَنِّ وَالْعَطاءِ",
                    german: "o Eigentümer der Vergebung und der Zufriedenheit, o Eigentümer der Gunst und der Gewährung",
                    slideNumber: "8"
                },
                {
                    arabic: "يا ذَا الْفَصْلِ وَالْقَضاءِ يا ذَا الْعِزِّ وَالْبَقاءِ يا ذَا الْجُودِ وَالسَّخاءِ يا ذَا الألآءِ وَالنَّعْماءِ",
                    german: "o Eigentümer der Entscheidung und des Urteils, o Eigentümer der Macht und der Ewigkeit, o Eigentümer der Freigiebigkeit und der Gunstbeweise, o Eigentümer der Wohltaten und der Gaben.",
                    slideNumber: "8"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مانِعُ يا دافِعُ يا رافِعُ يا صانِعُ يا نافِعُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Verhinderer, o Verteidiger, o Erhörer, o Erschaffer, o Wohltäter,",
                    slideNumber: "9"
                },
                {
                    arabic: "يا سامِعُ يا جامِعُ يا شافِعُ يا واسِعُ يا مُوسِعُ",
                    german: "o Erhörender, o Vereinender, o Fürsprecher, o Weitreichender, o reichlich Vermögender.",
                    slideNumber: "9"
                },
                {
                    arabic: "يا صانِعَ كُلِّ مَصْنُوعٍ يا خالِقَ كُلِّ مَخْلُوقٍ يا رازِقَ كُلِّ مَرْزُوقٍ يا مالِكَ كُلِّ مَمْلُوكٍ",
                    german: "o Erschaffer alles Erschaffenen, o Schöpfer aller Geschöpfe, o Versorger all dessen, was versorgt wird, o Herrscher aller Beherrschten,",
                    slideNumber: "10"
                },
                {
                    arabic: "يا كاشِفَ كُلِّ مَكْرُوبٍ يا فارِجَ كُلِّ مَهْمُومٍ",
                    german: "o Erlöser aller Leidenden, o Befreier aller Bekümmerten",
                    slideNumber: "10"
                },
                {
                    arabic: "يا راحِمَ كُلِّ مَرْحُومٍ يا ناصِرَ كُلِّ مَخْذُولٍ يا ساتِرَ كُلِّ مَعْيُوبٍ يا مَلْجَأَ كُلِّ مَطْرُودٍ",
                    german: "o Erbarmer aller Erbarmten, o Beistand aller in Stich gelassenen, o Verhüller aller Fehlerbehafteten, o Zuflucht aller Ausgestoßenen.",
                    slideNumber: "10"
                },
                {
                    arabic: "يا عُدَّتي عِنْدَ شِدَّتي يا رَجائي عِنْدَ مُصيبَتي يا مُونِسي عِنْدَ وَحْشَتي يا صاحِبي عِنْدَ غُرْبَتي",
                    german: "o mein Helfer in meiner Not, o meine Hoffnung in meiner Heimsuchung, o mein Vertrauter in meiner Einsamkeit, o mein Gefährte in meiner Fremde,",
                    slideNumber: "11"
                },
                {
                    arabic: "يا وَلِيّي عِنْدَ نِعْمَتي يا غِياثي عِنْدَ كُرْبَتي",
                    german: "o mein Wohltäter in meinen Gaben, o mein Helfer in meinen Sorgen,",
                    slideNumber: "11"
                },
                {
                    arabic: "يا دَليلي عِنْدَ حَيْرَتي يا غَنائي عِنْدَ افْتِقاري يا مَلجَأي عِنْدَ اضْطِراري يا مُعيني عِنْدَ مَفْزَعي",
                    german: "o mein Wegweiser in meiner Verwirrung, o mein Reichtum in meiner Mittellosigkeit, o meine Zuflucht in meiner Notlage, o mein Beistand in meinem Schrecken.",
                    slideNumber: "11"
                },
                {
                    arabic: "يا عَلاّمَ الْغُيُوبِ يا غَفّارَ الذُّنُوبِ يا سَتّارَ الْعُيُوبِ يا كاشِفَ الْكُرُوبِ يا مُقَلِّبَ الْقُلُوبِ يا طَبيبَ الْقُلُوبِ",
                    german: "o Wissender der verborgenen Dinge, o Vergebender der Sünden, o Verhüller der Fehler, o Beseitigender des Unheils, o Verfügender über die Herzen, o Heiler der Herzen, o Erleuchtender der Herzen,",
                    slideNumber: "12"
                },
                {
                    arabic: "يا مُنَوِّرَ الْقُلُوبِ يا اَنيسَ الْقُلُوبِ يا مُفَرِّجَ الْهُمُومِ يا مُنَفِّسَ الْغُمُومِ",
                    german: "o Erleuchtender der Herzen, o Geselliger der Herzen, o Erlöser von den Sorgen, o Befreier von den Kümmernissen.",
                    slideNumber: "12"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاْسمِكَ يا جَليلُ يا جَميلُ يا وَكيلُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Majestätischer, o Schöner, o Sachwalter,",
                    slideNumber: "13"
                },
                {
                    arabic: "يا كَفيلُ يا دَليلُ يا قَبيلُ يا مُديلُ يا مُنيلُ يا مُقيلُ يا مُحيلُ",
                    german: "o Bürge, o Wegweiser, o Garant, o Nahebringender, o Ermöglichender des Erlangens, o Hilfeeilender, o Kraftspender.",
                    slideNumber: "13"
                },
                {
                    arabic: "يا دَليلَ الْمُتَحَيِّرينَ يا غِياثَ الْمُسْتَغيثينَ يا صَريخَ الْمُسْتَصْرِخينَ يا جارَ الْمُسْتَجيرينَ",
                    german: "o Wegweiser der Verwirrten, o Rettung der Rettungssuchenden, o Hilfreicher der um Hilfe Rufenden, o Schutz der Schutzsuchenden,",
                    slideNumber: "14"
                },
                {
                    arabic: "يا اَمانَ الْخائِفينَ يا عَوْنَ الْمُؤْمِنينَ",
                    german: "o Sicherheit der Beängstigten, o Helfer der Gläubigen,",
                    slideNumber: "14"
                },
                {
                    arabic: "يا راحِمَ الْمَساكينَ يا مَلْجَأَ الْعاصينَ يا غافِرَ الْمُذْنِبينَ يا مُجيبَ دَعْوَةِ الْمُضْطَرّينَ",
                    german: "o Erbarmer der Elenden, o Zuflucht der Ungehorsamen, o Vergebender der Sündigen, o Erhörender des Rufes der Bedrängten.",
                    slideNumber: "14"
                },
                {
                    arabic: "يا ذَا الْجُودِ وَالاْحْسانِ يا ذَا الْفَضْلِ وَالاْمْتِنانِ يا ذَا الاْمْنِ وَالاْمانِ يا ذَا الْقُدْسِ وَالسُّبْحانِ",
                    german: "o Eigner der Freigebigkeit und der Wohltätigkeit, o Eigner der Huld und der Güte, o Eigner des Schutzes und der Sicherheit, o Eigner der Heiligkeit und der Verherrlichung,",
                    slideNumber: "15"
                },
                {
                    arabic: "يا ذَا الْحِكْمَةِ وَالْبَيانِ يا ذَا الرَّحْمَةِ وَالرِّضْوانِ",
                    german: "o Eigner der Weisheit und der Beredsamkeit, o Eigner der Gnade und der Zufriedenheit,",
                    slideNumber: "15"
                },
                {
                    arabic: "يا ذَا الْحُجَّةِ وَالْبُرْهانِ يا ذَا الْعَظَمَةِ وَالسُّلْطانِ يا ذَا الرَّأْفَةِ وَالْمُسْتَعانِ يا ذَا العَفْوِ وَالْغُفْرانِ",
                    german: "o Eigner des Arguments und des Beweises, o Eigner der Größe und der unumschränkten Macht, o Eigner der Gnade und der Unterstützung, o Eigner der Verzeihung und der Vergebung.",
                    slideNumber: "15"
                },
                {
                    arabic: "يا مَنْ هُوَ رَبُّ كُلِّ شَيْءٍ يا مَنْ هُوَ اِلـهُ كُلِّ شَيءٍ يا مَنْ هُوَ خالِقُ كُلِّ شَيْءٍ",
                    german: "o Jener, Der Herr aller Dinge ist, o Jener, Der Gott aller Dinge ist, o Jener, Der Schöpfer aller Dinge ist,",
                    slideNumber: "16"
                },
                {
                    arabic: "يا مَنْ هُوَ صانِعُ كُلِّ شَيْءٍ يا مَنْ هُوَ قَبْلَ كُلِّ شَيْءٍ يا مَنْ هُوَ بَعْدَ كُلِّ شَيْءٍ",
                    german: "o Jener, Der Erschaffer aller Dinge ist, o Jener, Der vor Allem war, o Jener, Der nach Allem sein wird,",
                    slideNumber: "16"
                },
                {
                    arabic: "يا مَنْ هُوَ فَوْقَ كُلِّ شَيْءٍ يا مَنْ هُوَ عالِمٌ بِكُلِّ شَيْءٍ",
                    german: "o Jener, Der über Allem steht, o Jener, Der alles weiß,",
                    slideNumber: "16"
                },
                {
                    arabic: "يا مَنْ هُوَ قادِرٌ عَلى كُلِّ شَيْءٍ يا مَنْ هُوَ يَبْقى وَيَفْنى كُلُّ شَيْءٍ",
                    german: "o Jener, Der Macht über alle Dinge besitzt, o Jener, Der beständig ist, während alles (andere) vergänglich ist.",
                    slideNumber: "16"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُؤْمِنُ يا مُهَيْمِنُ يا مُكَوِّنُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Überzeugender, o Beherrscher, o Urheber,",
                    slideNumber: "17"
                },
                {
                    arabic: "يا مُلَقِّنُ يا مُبَيِّنُ يا مُهَوِّنُ يا مُمَكِّنُ يا مُزَيِّنُ يا مُعْلِنُ يا مُقَسِّمُ",
                    german: "o Unterweiser, o Aufzeigender, o Erleichterer, o Ermöglicher, o Verschönerer, o Verkünder, o Verteilender.",
                    slideNumber: "17"
                },
                {
                    arabic: "يا مَنْ هُوَ في مُلْكِهِ مُقيمٌ يا مَنْ هُوَ في سُلْطانِهِ قديم يا مَنْ هُو في جَلالِهِ عَظيمٌ",
                    german: "o Jener, Der in seinem Königreich ewig ist, o Jener, Der in seiner unumschränkten Herrschaft immerwährend ist, o Jener, Der in seiner Pracht groß ist,",
                    slideNumber: "18"
                },
                {
                    arabic: "يا مَنْ هُوَ عَلى عِبادِهِ رَحيمٌ يا مَنْ هُوَ بِكُلِّ شَيْءٍ عَليمٌ يا مَنْ هُوَ بِمَنْ عَصاهُ حَليمٌ",
                    german: "o Jener, Der gegenüber seinen Dienern begnadend ist, o Jener, Der Wissend über alles ist, o Jener, Der nachsichtig gegenüber jenen ist, die Ihm gegenüber ungehorsam waren,",
                    slideNumber: "18"
                },
                {
                    arabic: "يا مَنْ هُوَ بِمَنْ رَجاهُ كَريمٌ يا مَنْ هُوَ في صُنْعِهِ حَكيمٌ يا مَنْ هُوَ في حِكْمَتِهِ لَطيفٌ يا مَنْ هُوَ في لُطْفِهِ قَديمٌ",
                    german: "o Jener, Der gegenüber jenen, die auf Ihn hoffen, großzügig ist, o Jener, Der in Seinem Handeln weise ist, o Jener, Der in Seiner Weisheit nachsichtig ist, o Jener, Dessen Nachsicht immerwährend ist.",
                    slideNumber: "18"
                },
                {
                    arabic: "يا مَنْ لا يُرْجى إلاّ فَضْلُهُ يا مَنْ لا يُسْأَلُ إلاّ عَفْوُهُ يا مَنْ لا يُنْظَرُ إلاّ بِرُّهُ",
                    german: "o Jener, außer Dessen Huld nichts erhofft wird, o Jener, außer Dessen Vergebung nichts erbeten wird, o Jener, außer Dessen Güte nichts erwartet wird,",
                    slideNumber: "19"
                },
                {
                    arabic: "يا مَنْ لا يُخافُ إلاّ عَدْلُهُ يا مَنْ لا يَدُومُ إلاّ مُلْكُهُ يا مَنْ لا سُلْطانَ إلاّ سُلْطانُهُ",
                    german: "o Jener, außer Dessen Gerechtigkeit nichts gefürchtet wird, o Jener, außer Dessen Reich nichts überdauert, o Jener, außer Dessen Herrschaftsgewalt es keine Herrschaftsgewalt gibt,",
                    slideNumber: "19"
                },
                {
                    arabic: "يا مَنْ وَسِعَتْ كُلَّ شَيْءٍ رَحْمَتُهُ يا مَنْ سَبَقَتْ رَحْمَتُهُ غَضَبَهُ",
                    german: "o Jener, Dessen Gnade alles umfasst, o Jener, Dessen Gnade Seinen Zorn übertrifft,",
                    slideNumber: "19"
                },
                {
                    arabic: "يا مَنْ اَحاطَ بِكُلِّ شَيْءٍ عِلْمُهُ يا مَنْ لَيْسَ اَحَدٌ مِثْلَهُ",
                    german: "o Jener, Dessen Wissen alles umfasst, o Jener, dem keiner ähnelt.",
                    slideNumber: "19"
                },
                {
                    arabic: "يا فارِجَ الْهَمِّ يا كاشِفَ الْغَمِّ يا غافِرَ الذَّنْبِ يا قابِلَ التَّوْبِ يا خالِقَ الْخَلْقِ",
                    german: "o Befreier von den Sorgen, o Beseitigender des Kummers, o Vergebender der Sünden, o Annehmender der Reue, o Schöpfer der Schöpfung,",
                    slideNumber: "20"
                },
                {
                    arabic: "يا صادِقَ الْوَعْدِ يا مُوفِيَ الْعَهْدِ يا عالِمَ السِّرِّ يا فالِقَ الْحَبِّ يا رازِقَ الاْنامِ",
                    german: "o Jener, Der Seinem Versprechen treu ist, o Einhalter des Vertrages, o Wissender der Geheimnisse, o Spalter der Samenkörner, o Ernährer der Menschen.",
                    slideNumber: "20"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا عَلِيُّ يا وَفِيُّ يا غَنِيُّ يا مَلِيُّ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Höchster, o Treuer, o Sich Selbst Genügender, o Zeitloser,",
                    slideNumber: "21"
                },
                {
                    arabic: "يا حَفِيُّ يا رَضِيُّ يا زَكِيُّ يا بَدِيُّ يا قَوِيُّ يا وَلِيُّ",
                    german: "o Ehrender, o Zufriedener, o Reiner, o Offenbarer, o Starker, o Vormund.",
                    slideNumber: "21"
                },
                {
                    arabic: "يا مَنْ اَظْهَرَ الْجَميلَ يا مَنْ سَتَرَ الْقَبيحَ يا مَنْ لَمْ يُؤاخِذْ بِالْجَريرَةِ",
                    german: "o Jener, Der das Schöne enthüllt, o Jener, Der das Hässliche verhüllt, o Jener, Der das Verbrechen nicht gleich bestraft,",
                    slideNumber: "22"
                },
                {
                    arabic: "يا مَنْ لَمْ يَهْتِكِ السِّتْرَ يا عَظيمَ الْعَفْوِ يا حَسَنَ التَّجاوُزِ يا واسِعَ الْمَغْفِرَةِ",
                    german: "o Jener, Der das Schöne enthüllt, o Jener, Der das Hässliche verhüllt, o Jener, Der das Verbrechen nicht gleich bestraft, o Jener, Der den Schutz nicht entreißt, o Jener, Dessen Vergebung groß ist, o Jener, Der gütig unbestraft lässt, o Jener, Dessen Vergebung allumfassend ist,",
                    slideNumber: "22"
                },
                {
                    arabic: "يا باسِطَ الْيَدَيْنِ بِالرَّحْمَةِ يا صاحِبَ كُلِّ نَجْوى يا مُنْتَهى كُلِّ شَكْوى",
                    german: "o Jener, Der mit Gnade freigiebig ist, o Gefährte aller stillen Gebete, o letzte Instanz aller Beschwerden.",
                    slideNumber: "22"
                },
                {
                    arabic: "يا ذَا النِّعْمَةِ السّابِغَةِ يا ذَا الرَّحْمَةِ الْواسِعَةِ يا ذَا الْمِنَّةِ السّابِقَةِ يا ذَا الْحِكْمَةِ الْبالِغَةِ",
                    german: "o Eigner der im Überfluss vorhandenen Gaben, o Eigner der weitreichenden Gnade, o Eigner vergangener Gunst, o Eigner der außerordentlichen Weisheit,",
                    slideNumber: "23"
                },
                {
                    arabic: "يا ذَا الْقُدْرَةِ الْكامِلَةِ يا ذَا الْحُجَّةِ الْقاطِعَةِ",
                    german: "o Eigner der absoluten Macht, o Eigner des schlagenden Arguments,",
                    slideNumber: "23"
                },
                {
                    arabic: "يا ذَا الْكَرامَةِ الظّاهِرَةِ يا ذَا الْعِزَّةِ الدّائِمَةِ يا ذَا الْقُوَّةِ الْمَتينَةِ يا ذَا الْعَظَمَةِ الْمَنيعَةِ",
                    german: "o Eigner der offensichtlichen Ehre, o Eigner der dauerhaften Erhabenheit, o Eigner der festen Macht, o Eigner der unüberwindbaren Größe.",
                    slideNumber: "23"
                },
                {
                    arabic: "يا بَديعَ السَّماواتِ يا جاعِلَ الظُّلُماتِ يا راحِمَ الْعَبَراتِ يا مُقيلَ الْعَثَراتِ",
                    german: "o Schöpfer der Himmel, o Errichter der Finsternisse,o Erbarmer der Tränen, o Aufhebender der Verfehlungen",
                    slideNumber: "24"
                },
                {
                    arabic: "يا ساتِرَ الْعَوْراتِ يا مُحْيِيَ الأمْواتِ",
                    german: "o Auslöschender der schlechten Taten, o Strenger der Bestrafenden.",
                    slideNumber: "24"
                },
                {
                    arabic: "يا مُنْزِلَ الآياتِ يا مُضَعِّفَ الْحَسَناتِ يا ماحِيَ السَّيِّئاتِ يا شَديدَ النَّقِماتِ",
                    german: "o Herabsendender der Zeichen, o Vervielfacher der guter Taten, o Auslöschender der schlechten Taten, o Strenger der Bestrafenden.",
                    slideNumber: "24"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُصَوِّرُ يا مُقَدِّرُ يا مُدَبِّرُ يا مُطَهِّرُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Gestalter, o Vorbestimmender, o Waltender, o Bereinigender,",
                    slideNumber: "25"
                },
                {
                    arabic: "يا مُنَوِّرُ يا مُيَسِّرُ يا مُبَشِّرُ يا مُنْذِرُ يا مُقَدِّمُ يا مُؤَخِّرُ",
                    german: "o Erleuchtender, o Erleichterer, o Verkünder, o Ermahner, o Vorziehender, o Aufschiebender.",
                    slideNumber: "25"
                },
                {
                    arabic: "يا رَبَّ الْبَيْتِ الْحَرامِ يا رَبَّ الشَّهْرِ الْحَرامِ يا رَبَّ الْبَلَدِ الْحَرامِ",
                    german: "o Herr des geweihten Hauses, o Herr des geweihten Monats, o Herr der geweihten Stadt",
                    slideNumber: "26"
                },
                {
                    arabic: "يا رَبَّ الرُّكْنِ وَالْمَقامِ يا رَبَّ الْمَشْعَرِ الْحَرامِ يا رَبَّ الْمَسْجِدِ الْحَرامِ",
                    german: "o Herr der Stellung und des Ranges, o Herr des geweihten “Maschar“, o Herr der geweihten Moschee,",
                    slideNumber: "26"
                },
                {
                    arabic: "يا رَبَّ الْحِلِّ وَالْحَرامِ يا رَبَّ النُّورِ وَالظَّلامِ يا رَبَّ التَّحِيَّةِ وَالسَّلامِ يا رَبَّ الْقُدْرَةِ فِي الاْنام",
                    german: "o Herr des Erlaubten und des Verbotenen, o Herr des Lichtes und der Finsternis o Herr der Begrüßung und des Friedens o Herr der Macht über die Menschen.",
                    slideNumber: "26"
                },
                {
                    arabic: "يا اَحْكَمَ الْحاكِمينَ يا اَعْدَلَ الْعادِلينَ يا اَصْدَقَ الصّادِقينَ",
                    german: "o Mächtigster der Regierenden, o Gerechtester der Gerechten, o Aufrichtigster der Aufrichtigen,",
                    slideNumber: "27"
                },
                {
                    arabic: "يا اَطْهَرَ الطّاهِرينَ يا اَحْسَنَ الْخالِقينَ يا اَسْرَعَ الْحاسِبينَ",
                    german: "o Reinster der Reinen, o Schönster der Schöpfer, o Schnellster der Abrechnenden,",
                    slideNumber: "27"
                },
                {
                    arabic: "يا اَسْمَعَ السّامِعينَ يا اَبْصَرَ النّاظِرينَ يا اَشْفَعَ الشّافِعينَ يا اَكْرَمَ الاْكْرَمينَ",
                    german: "Besthörender der Hörenden, o Scharfsichtiger der Schauenden, o bester Fürsprecher der Fürsprecher, o Großzügigster der Großzügigen.",
                    slideNumber: "27"
                },
                {
                    arabic: "يا عِمادَ مَنْ لا عِمادَ لَهُ يا سَنَدَ مَنْ لا سَنَدَ لَهُ يا ذُخْرَ مَنْ لا ذُخْرَ لَهُ",
                    german: "o Stütze dessen, der keine Stütze hat, o Rückhalt dessen, der keinen Rückhalt hat, o Reichtum dessen, der keinen Reichtum hat,",
                    slideNumber: "28"
                },
                {
                    arabic: "يا حِرْزَ مَنْ لا حِرْزَ لَهُ يا غِياثَ مَنْ لا غِياثَ لَهُ يا فَخْرَ مَنْ لا فَخْرَ لَهُ",
                    german: "o Festung dessen, der keine Festung hat, o Retter dessen, der keinen Retter hat, o Stolz dessen, der keinen Stolz hat,",
                    slideNumber: "28"
                },
                {
                    arabic: "يا عِزَّ مَنْ لا عِزَّ لَهُ يا مُعينَ مَنْ لا مُعينَ لَهُ يا اَنيسَ مَنْ لا اَنيسَ لَهُ يا اَمانَ مَنْ لا اَمانَ لَهُ",
                    german: "o Ruhm dessen, der keinen Ruhm hat, o Beistand dessen, der keinen Beistand hat, o Gefährte dessen, der keinen Gefährten hat, o Sicherheit dessen, der keine Sicherheit hat.",
                    slideNumber: "28"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا عاصِمُ يا قائِمُ يا دائِمُ يا راحِمُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Beschützer, o Währender, o Ewiger, o Erbarmer,",
                    slideNumber: "29"
                },
                {
                    arabic: "يا سالِمُ يا حاكِمُ يا عالِمُ يا قاسِمُ يا قابِضُ يا باسِطُ",
                    german: "o Unfehlbarer, o Regierender, o Allwissender, o Verteiler, o Begrenzender, o Ausbreitender.",
                    slideNumber: "29"
                },
                {
                    arabic: "يا عاصِمَ مَنِ اسْتَعْصَمَهُ يا راحِمَ مَنِ اسْتَرْحَمَهُ يا غافِرَ مَنِ اسْتَغْفَرَهُ",
                    german: "o Beschützer derer, die Seinen Schutz suchen, o Erbarmer derer, die Ihn um Erbarmen anflehen, o Vergebender derer, die Seine Vergebung erhoffen",
                    slideNumber: "30"
                },
                {
                    arabic: "يا ناصِرَ مَنِ اسْتَنْصَرَهُ يا حافِظَ مَنِ اسْتَحْفَظَهُ يا مُكْرِمَ مَنِ اسْتَكْرَمَهُ",
                    german: "o Helfer derer, die Ihn um Hilfe ersuchen, o Hüter derer, die sich Seiner Obhut anvertrauen, o Wohltäter derer, die Seine Wohltaten erhoffen,",
                    slideNumber: "30"
                },
                {
                    arabic: "يا مُرْشِدَ مَنِ اسْتَرْشَدَهُ يا صَريخَ مَنِ اسْتَصْرَخَهُ",
                    german: "o Wegweiser derer, die nach Seiner Weisung verlangen, o Erlöser derer, die zu Ihm um Erlösung rufen,",
                    slideNumber: "30"
                },
                {
                    arabic: "يا مُعينَ مَنِ اسْتَعانَهُ يا مُغيثَ مَنِ اسْتَغاثَهُ",
                    german: "o Beistand derer, die Seinen Beistand ersehnen, o Erretter derer, die Ihn um Rettung ersuchen.",
                    slideNumber: "30"
                },
                {
                    arabic: "يا عَزيزاً لا يُضامُ يا لَطيفاً لا يُرامُ يا قَيُّوماً لا يَنامُ يا دائِماً لا يَفُوتُ",
                    german: "o Mächtiger, Der nicht geschädigt werden kann, o Gütiger, Der unerreichbar ist, o Beständiger, Der niemals schläft, o Ewiger, Der niemals vergeht,",
                    slideNumber: "31"
                },
                {
                    arabic: "يا حَيّاً لا يَمُوتُ يا مَلِكاً لا يَزُولُ يا باقِياً لا يَفْنى",
                    german: "o Lebendiger, Der niemals stirbt, o König, Der niemals zugrunde geht, O Überlebender, Der niemals untergeht,",
                    slideNumber: "31"
                },
                {
                    arabic: "يا عالِماً لا يَجْهَلُ يا صَمَداً لا يُطْعَمُ يا قَوِيّاً لا يَضْعُفُ",
                    german: "o Allwissender, Der niemals unwissend ist, o Unabhängiger, Der nicht auf Nahrung angewiesen ist, o Starker, Der niemals schwach ist.",
                    slideNumber: "31"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَحَدُ يا واحِدُ يا شاهِدُ يا ماجِدُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Einziger, o Einer o Bezeugender, o Gerühmter,",
                    slideNumber: "32"
                },
                {
                    arabic: "يا حامِدُ يا راشِدُ يا باعِثُ يا وارِثُ يا ضارُّ يا نافِعُ",
                    german: "o Lobender, o Rechtleitender, o Lebenserweckender, o Erbe, o Schädigungsfähiger, o Wohltäter.",
                    slideNumber: "32"
                },
                {
                    arabic: "يا اَعْظَمَ مِنْ كُلِّ عَظيمٍ يا اَكْرَمَ مِنْ كُلِّ كَريمٍ يا اَرْحَمَ مِنْ كُلِّ رَحيمٍ",
                    german: "o Gewaltigster aller Gewaltigen, o Großzügigster aller Großzügigen, o Gnädigster aller Begnadenden,",
                    slideNumber: "33"
                },
                {
                    arabic: "يا اَعْلَمَ مِنْ كُلِّ عَليمٍ يا اَحْكَمَ مِنْ كُلِّ حَكيمٍ يا اَقْدَمَ مِنْ كُلِّ قَديمٍ",
                    german: "o Wissendster aller Wissenden, o Höchstregierender aller Regierenden, o Existierender vor jeder Existenz,",
                    slideNumber: "33"
                },
                {
                    arabic: "يا اَكْبَرَ مِنْ كُلِّ كَبيرٍ يا اَلْطَفَ مِنْ كُلِّ لَطيفٍ يا اَجَلَّ مِن كُلِّ جَليلٍ يا اَعَزَّ مِنْ كُلِّ عَزيزٍ",
                    german: "o Größter aller Größen, o Gütigster aller Gütigen, o Majestätischster aller Majestätischen, o Kraftvollster aller Kraftvollen.",
                    slideNumber: "33"
                },
                {
                    arabic: "يا كَريمَ الصَّفْحِ يا عَظيمَ الْمَنِّ يا كَثيرَ الْخَيْرِ يا قَديمَ الْفَضْلِ يا دائِمَ اللُّطْفِ يا لَطيفَ الصُّنْعِ",
                    german: "o großzügig Verzeihender, o Dessen Gunst groß ist, o Dessen Wohltaten viele sind, o Dessen Huld beständig ist, o Dessen Sanftmütigkeit ewig ist, o Dessen Handeln gütig ist",
                    slideNumber: "34"
                },
                {
                    arabic: "يا مُنَفِّسَ الْكَرْبِ يا كاشِفَ الضُّرِّ يا مالِكَ الْمُلْكِ يا قاضِيَ الْحَقِّ",
                    german: "o Erlöser vom Unheil, o Beseitigender des Schadens, o Eigentümer jedes Eigentums, o Richter des Rechts",
                    slideNumber: "34"
                },
                {
                    arabic: "يا مَنْ هُوَ في عَهْدِهِ وَفِيٌّ يا مَنْ هُوَ في وَفائِهِ قَوِيٌّ يا مَنْ هُوَ في قُوَّتِهِ عَلِيٌّ",
                    german: "o Jener, Der Sein Versprechen erfüllt, o Jener, Der in der Erfüllung Seines Versprechens stark ist, o Jener, Der in Seiner Stärke erhaben ist,",
                    slideNumber: "35"
                },
                {
                    arabic: "يا مَنْ هُوَ في عُلُوِّهِ قَريبٌ يا مَنْ هُوَ في قُرْبِهِ لَطيفٌ يا مَنْ هُوَ في لُطْفِهِ شَريفٌ",
                    german: "o Jener, Der in Seiner Erhabenheit nah ist, o Jener, Der in Seiner Nähe gütig ist, o Jener, Der in Seiner Gütigkeit ehrenhaft ist,",
                    slideNumber: "35"
                },
                {
                    arabic: "يا مَنْ هُوَ في شَرَفِهِ عَزيزٌ يا مَنْ هُوَ في عِزِّهِ عَظيمٌ يا مَنْ هُوَ في عَظَمَتِهِ مَجيدٌ يا مَنْ هُوَ في مَجْدِهِ حَميدٌ",
                    german: "o Jener, Der in Seiner Ehrenhaftigkeit mächtig ist, o Jener, Der in Seiner Macht groß ist, o Jener, Der in Seiner Größe ruhmreich ist, o Jener, Der in Seinem Ruhm lobenswert ist.",
                    slideNumber: "35"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا كافي يا شافي يا وافى يا مُعافي",
                    german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Abwendender, o Heiler, o Genügender, o Schützer,",
                    slideNumber: "36"
                },
                {
                    arabic: "يا هادي يا داعي يا قاضي يا راضي يا عالي يا باقي",
                    german: "o Rechtleiter, o Einladender, o Richter, o Zufriedenstellender, o Hoher, o Überlebender.",
                    slideNumber: "36"
                },
                {
                    arabic: "يا مَنْ كُلُّ شَيْءٍ خاضِعٌ لَهُ يا مَنْ كُلُّ شَيْءٍ خاشِعٌ لَهُ يا مَنْ كُلُّ شَيْءٍ كائِنٌ لَهُ",
                    german: "o Jener, Dem sich alles unterwirft, o Jener, gegenüber Dem alles demütig ist, o Jener, für Den alles existiert,",
                    slideNumber: "37"
                },
                {
                    arabic: "يا مَنْ كُلُّ شَيْءٍ مَوْجُودٌ بِهِ يا مَنْ كُلُّ شَيْءٍ مُنيبٌ اِلَيْهِ يا مَنْ كُلُّ شَيْءٍ خائِفٌ مِنْهُ",
                    german: "o Jener, durch Den alles existiert, o Jener, zu Dem alle Reue zeigen, o Jener, vor Dem sich alles fürchtet,",
                    slideNumber: "37"
                },
                {
                    arabic: "يا مَنْ كُلُّ شَيْءٍ قائِمٌ بِهِ يا مَنْ كُلُّ شَيْءٍ صائِرٌ اِلَيْهِ",
                    german: "o Jener, durch Den alles aufrecht ist, o Jener, zu Dem alles gelangt,",
                    slideNumber: "37"
                },
                {
                    arabic: "يا مَنْ كُلُّ شَيْءٍ يُسَبِّحُ بِحَمْدِهِ يا مَنْ كُلُّ شَيْءٍ هالِكٌ إلاّ وَجْهَهُ",
                    german: "o Jener, Den alles in Seiner Dankbarkeit lobpreist, o Jener, außer Dessen Antlitz alles untergeht.",
                    slideNumber: "37"
                },
                {
                    arabic: "يا مَنْ لا مَفَرَّ إلاّ اِلَيْهِ يا مَنْ لا مَفْزَعَ إلاّ اِلَيْهِ يا مَنْ لا مَقْصَدَ إلاّ اِلَيْهِ",
                    german: "o Jener, außer Dem es keinen Ausweg gibt, o Jener, außer Dem es keinen Zufluchtsort gibt, o Jener, außer Dem es kein Ziel gibt,",
                    slideNumber: "38"
                },
                {
                    arabic: "يا مَنْ لا مَنْجا مِنْهُ إلاّ اِلَيْهِ يا مَنْ لا يُرْغَبُ إلاّ اِلَيْهِ يا مَنْ لا حَوْلَ وَلا قُوَّةَ إلاّ بِهِ",
                    german: "o Jener, außer Dem es keine Rettung gibt, o Jener, außer Dem nichts erwünscht wird, o Jener, außer durch Den es keine Kraft, noch Macht gibt,",
                    slideNumber: "38"
                },
                {
                    arabic: "يا مَنْ لا يُسْتَعانُ إلاّ بِهِ يا مَنْ لا يُتَوَكَّلُ إلاّ عَلَيْهِ يا مَنْ لا يُرْجى إلاّ هُوَ يا مَنْ لا يُعْبَدُ إلاّ هو",
                    german: "o Jener, außer Dem niemand um Hilfe gebeten wird, o Jener, außer Dem kein Verlass ist, o Jener, außer Dem niemand gebeten wird, o Jener, außer Dem niemand angebetet wird.",
                    slideNumber: "38"
                },
                {
                    arabic: "يا خَيْرَ الْمَرْهُوبينَ يا خَيْرَ الْمَرْغُوبينَ يا خَيْرَ الْمَطْلُوبينَ",
                    german: "O Segenreichster der Gefürchteten, o Segenreichster der Erwünschten, o Segenreichster der Begehrten,",
                    slideNumber: "39"
                },
                {
                    arabic: "يا خَيْرَ الْمَسْؤولينَ يا خَيْرَ الْمَقْصُودينَ يا خَيْرَ الْمَذْكُورينَ",
                    german: "o Segenreichster der Verantwortlichen, o Segenreichster der Erstrebten, o Segenreichster der Erwähnten,",
                    slideNumber: "39"
                },
                {
                    arabic: "يا خَيْرَ الْمَشْكُورينَ يا خَيْرَ الْمحْبُوبينَ يا خَيْرَ الْمَدْعُوّينَ يا خَيْرَ الْمُسْتَأْنِسينَ",
                    german: "o Segenreichster der Gedankten, o Segenreichster der Geliebten, o Segenreichster der Angebetenen, o Segenreichster der Anvertrauten.",
                    slideNumber: "39"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا غافِرُ يا ساتِرُ يا قادِرُ يا قاهِرُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Vergebender, o Verhüller, o Mächtiger, o Bezwinger,",
                    slideNumber: "40"
                },
                {
                    arabic: "يا فاطِرُ يا كاسِرُ يا جابِرُ يا ذاكِرُ يا ناظِرُ يا ناصِرُ",
                    german: "o Schöpfer, o Besiegender, o Zwingender, o Erwähnender, o Prüfender, o Unterstützer.",
                    slideNumber: "40"
                },
                {
                    arabic: "يا مَنْ خَلَقَ فَسَوّى يا مَنْ قَدَّرَ فَهَدى يا مَنْ يَكْشِفُ الْبَلْوى",
                    german: "o Jener, Der erschaffen und geordnet hat, o Jener, Der bestimmt und den rechten Weg gewiesen hat, o Jener, Der das Unheil beseitigt,",
                    slideNumber: "41"
                },
                {
                    arabic: "يا مَنْ يَسْمَعُ النَّجْوى يا مَنْ يُنْقِذُ الْغَرْقى يا مَنْ يُنْجِي الْهَلْكى",
                    german: "o Jener, Der die heimlichen Unterredungen hört, o Jener, Der die Ertrinkenden rettet, o Jener, Der die zu Grunde Gehenden birgt,",
                    slideNumber: "41"
                },
                {
                    arabic: "يا مَنْ يَشْفِي الْمَرْضى يا مَنْ اَضْحَكَ وَاَبْكى",
                    german: "o Jener, Der die Kranken heilt, o Jener, Der lachen und weinen lässt,",
                    slideNumber: "41"
                },
                {
                    arabic: "يا مَنْ اَماتَ وَاَحْيى يا مَنْ خَلَقَ الزَّوْجَيْنِ الذَّكَرَ وَالاْنْثى",
                    german: "o Jener, Der leben und sterben lässt, o Jener, Der die Paare erschaffen hat, das Männliche und das Weibliche.",
                    slideNumber: "41"
                },
                {
                    arabic: "يا مَنْ فيِ الْبَرِّ وَالْبَحْرِ سَبيلُهُ يا مَنْ فِي الاْفاقِ اياتُهُ يا مَنْ فِي الاْياتِ بُرْهانُهُ",
                    german: "o Jener, Dem zu Land und zu Wasser Wege offen stehen, o Jener, Dessen Zeichen an den Horizonten sind, o Jener, Dessen Beweis in den Zeichen liegt,",
                    slideNumber: "42"
                },
                {
                    arabic: "يا مَنْ فِي الْمَماتِ قُدْرَتُهُ يا مَنْ فِي الْقُبُورِ عِبْرَتُهُ يا مَنْ فِي الْقِيامَةِ مُلْكُهُ",
                    german: "o Jener, Dessen Macht sich im Tode zeigt, o Jener, Dessen Lehre sich in den Gräbern zeigt, o Jener, Dessen Herrschaft sich in der Auferstehung zeigt,",
                    slideNumber: "42"
                },
                {
                    arabic: "يا مَنْ فِي الْحِسابِ هَيْبَتُهُ يا مَنْ فِي الْميزانِ قَضاؤُهُ يا مَنْ فِي الْجَنَّةِ ثَوابُهُ يا مَنْ فِي النّارِ عِقابُهُ",
                    german: "o Jener, Dessen Ehrfurchtgebietung sich in der Rechenschaft zeigt, o Jener, Dessen Urteil sich auf der Waage zeigt, o Jener, Dessen Belohnung sich im Paradies zeigt, o Jener, Dessen Bestrafung sich in der Feuer zeigt.",
                    slideNumber: "42"
                },
                {
                    arabic: "يا مَنْ اِلَيْهِ يَهْرَبُ الْخائِفُونَ يا مَنْ اِلَيْهِ يَفْزَعُ الْمُذْنِبُونَ يا مَنْ اِلَيْهِ يَقْصِدُ الْمُنيبُونَ",
                    german: "o Jener, zu Dem die Verängstigten fliehen, o Jener, bei dem die Sünder Zuflucht suchen, o Jener, an Den sich die Bereuenden wenden,",
                    slideNumber: "43"
                },
                {
                    arabic: "يا مَنْ اِلَيْهِ يَرْغَبُ الزّاهِدُونَ يا مَنْ اِلَيْهِ يَلْجَأُ الْمُتَحَيِّرُونَ يا مَنْ بِهِ يَسْتَأْنِسُ الْمُريدُونَ",
                    german: "o Jener, den die Welt-Entsagenden begehren, o Jener, zu Dem die Verwirrten fliehen, o Jener, Den diejenigen, die nach Ihm verlangen, vertrauen,",
                    slideNumber: "43"
                },
                {
                    arabic: "يا مَنْ بِه يَفْتَخِرُ الْمحِبُّونَ يا مَنْ في عَفْوِهِ يَطْمَعُ الْخاطِئُونَ",
                    german: "o Jener, auf Den die Liebenden stolz sind, o Jener, Dessen Verzeihung die Fehlerhaften wünschen,",
                    slideNumber: "43"
                },
                {
                    arabic: "يا مَنْ اِلَيْهِ يَسْكُنُ الْمُوقِنُونَ يا مَنْ عَلَيْهِ يَتَوَكَّلُ الْمُتَوَكِّلُونَ",
                    german: "o Jener, bei Dem die mit Gewissheit Ruhe finden, o Jener, auf Den die Vertrauenden vertrauen.",
                    slideNumber: "43"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا حَبيبُ يا طَبيبُ يا قَريبُ يا رَقيبُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Geliebter, o Heiler o Naher, o Beobachter",
                    slideNumber: "44"
                },
                {
                    arabic: "يا حَسيبُ يا مُهيبُ يا مُثيبُ يا مُجيبُ يا خَبيرُ يا نَصِيرُ",
                    german: "o Abrechnender, o Ehrfurchtsgebietender, o Belohnender, o Erfüllender o Erfahrener, o Allsehender.",
                    slideNumber: "44"
                },
                {
                    arabic: "يا اَقَرَبَ مِنْ كُلِّ قَريبٍ يا اَحَبَّ مِنْ كُلِّ حَبيبٍ يا اَبْصَرَ مِنْ كُلِّ بَصيرٍ",
                    german: "o Nächster aller Nahen, o Geliebtester aller Geliebten, o Sehendster aller Sehenden,",
                    slideNumber: "45"
                },
                {
                    arabic: "يا اَخْبَرَ مِنْ كُلِّ خَبيرٍ يا اَشْرَفَ مِنْ كُلِّ شَريفٍ يا اَرْفَعَ مِنْ كُلِّ رَفيعٍ",
                    german: "o Erfahrenster aller Erfahrenen, o Ehrenhaftester aller Ehrenhaften, o Hochrangigster aller Hochrangigen,",
                    slideNumber: "45"
                },
                {
                    arabic: "يا اَقْوى مِنْ كُلِّ قَوِيٍّ يا اَغْنى مِنْ كُلِّ غَنِيٍّ يا اَجْوَدَ مِنْ كُلِّ جَوادٍ يا اَرْاَفَ مِنْ كُلِّ رَؤوُفٍ",
                    german: "o Kraftvollster aller Kraftvollen, o Reichster aller Reichen, o Freigebigster aller Freigebigen, o Erbarmendster aller Erbarmenden.",
                    slideNumber: "45"
                },
                {
                    arabic: "يا غالِباً غَيْرَ مَغْلُوبٍ يا صانِعاً غَيْرَ مَصْنُوعٍ يا خالِقاً غَيْرَ مَخْلُوقٍ",
                    german: "o Sieger ohne Niederlage, o Erschaffer ohne erschaffen zu sein, o Schöpfer ohne geschöpft worden zu sein,",
                    slideNumber: "46"
                },
                {
                    arabic: "يا مالِكاً غَيْرَ مَمْلُوكٍ يا قاهِراً غَيْرَ مَقْهُورٍ يا رافِعاً غَيْرَ مَرْفُوعٍ",
                    german: "o Besitzer, ohne Eigentum zu sein, o Bezwinger, ohne bezwungen zu werden, o Erhöhender, ohne erhöht zu werden,",
                    slideNumber: "46"
                },
                {
                    arabic: "يا حافِظاً غَيْرَ مَحْفُوظٍ يا ناصِراً غَيْرَ مَنْصُورٍ",
                    german: "o Bewahrer, ohne bewahrt zu werden, o Unterstützer, ohne unterstützt zu werden,",
                    slideNumber: "46"
                },
                {
                    arabic: "يا شاهِداً غَيْرَ غائِبٍ يا قَريباً غَيْرَ بَعيدٍ",
                    german: "o Zeuge, ohne abwesend zu sein, o Naher, ohne fern zu sein.",
                    slideNumber: "46"
                },
                {
                    arabic: "يا نُورَ النُّورِ يا مُنَوِّرَ النُّورِ يا خالِقَ النُّورِ",
                    german: "o Licht des Lichtes, o Erleuchtender des Lichtes, o Schöpfer des Lichtes,",
                    slideNumber: "47"
                },
                {
                    arabic: "يا مُدَبِّرَ النُّورِ يا مُقَدِّرَ النُّورِ يا نُورَ كُلِّ نُورٍ",
                    german: "o Gestalter des Lichtes, o Abschätzer des Lichtes, o Licht jedes Lichtes,",
                    slideNumber: "47"
                },
                {
                    arabic: "يا نُوراً قَبْلَ كُلِّ نُورٍ يا نُوراً بَعْدَ كُلِّ نُورٍ",
                    german: "o Licht, das vor jedem Licht da war, o Licht, das nach jedem Licht da sein wird,",
                    slideNumber: "47"
                },
                {
                    arabic: "يا نُوراً فَوْقَ كُلِّ نُورٍ يا نُوراً لَيْسَ كَمِثْلِهِ نُورٌ",
                    german: "o Licht, das über allen Lichtern steht, o Licht, dem kein Licht ebenbürtig ist.",
                    slideNumber: "47"
                },
                {
                    arabic: "يا مَنْ عَطاؤُهُ شَريفٌ يا مَنْ فِعْلُهُ لَطيفٌ يا مَنْ لُطْفُهُ مُقيمٌ",
                    german: "o Jener, Dessen Gaben ehrenhaft sind, o Jener, Dessen Handeln nachsichtig ist, o Jener, Dessen Nachsicht beständig ist,",
                    slideNumber: "48"
                },
                {
                    arabic: "يا مَنْ اِحْسانُهُ قَديمٌ يا مَنْ قَوْلُهُ حَقٌّ يا مَنْ وَعْدُهُ صِدْقٌ",
                    german: "o Jener, Dessen Wohltätigkeit von jeher bestehend ist, o Jener, Dessen Wort die Wahrheit ist, o Jener, Dessen Versprechen aufrichtig ist,",
                    slideNumber: "48"
                },
                {
                    arabic: "يا مَنْ عَفْوُهُ فَضْلٌ يا مَنْ عَذابُهُ عَدْلٌ",
                    german: "o Jener, Dessen Vergebung Huld ist, o Jener, Dessen Bestrafung gerecht ist,",
                    slideNumber: "48"
                },
                {
                    arabic: "يا مَنْ ذِكْرُهُ حُلْوٌ يا مَنْ فَضْلُهُ عَميمٌ",
                    german: "o Jener, Dessen Erwähnung süß ist, o Jener, Dessen Huld umfassend ist.",
                    slideNumber: "48"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُسَهِّلُ يا مُفَصِّلُ يا مُبَدِّلُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Erleichterer, o Verdeutlicher, o Verwandler,",
                    slideNumber: "49"
                },
                {
                    arabic: "يا مُذَلِّلُ يا مُنَزِّلُ يا مُنَوِّلُ يا مُفْضِلُ يا مُجْزِلُ يا مُمْهِلُ يا مُجْمِلُ",
                    german: "o Demütigender, o Herabsender, o Verschaffer, o Huldvoller, o Freigiebiger, o Verschonender, o Verleiher von Schönheit.",
                    slideNumber: "49"
                },
                {
                    arabic: "يا مَنْ يَرى وَلا يُرى يا مَنْ يَخْلُقُ وَلا يُخْلَقُ يا مَنْ يَهْدي وَلا يُهْدى",
                    german: "o Jener, Der sieht, Er aber nicht sichtbar ist, o Jener, der erschafft, Er aber nicht erschaffen ist, o Jener, Der den rechten Weg weist, Dem aber nicht der Weg gewiesen wird,",
                    slideNumber: "50"
                },
                {
                    arabic: "يا مَنْ يُحْيي وَلا يُحْيا يا مَنْ يَسْأَلُ وَلا يُسْأَلُ يا مَنْ يُطْعِمُ وَلا يُطْعَمُ",
                    german: "o jener, Der zum Leben erweckt, Er aber nicht zum Leben erweckt wird, o Jener, Der fragt, Er aber nicht befragt wird, o Jener, Der speist, Er aber nicht gespeist wird,",
                    slideNumber: "50"
                },
                {
                    arabic: "يا مَنْ يُجيرُ وَلا يُجارُ عَلَيْهِ يا مَنْ يَقْضي وَلا يُقْضى عَلَيْهِ",
                    german: "o Jener, Der Schutz gebietet, vor Dem es aber keinen Schutz gibt, o Jener, Der richtet, über Den aber nicht gerichtet wird,",
                    slideNumber: "50"
                },
                {
                    arabic: "يا مَنْ يَحْكُمُ وَلا يُحْكَمُ عَلَيْهِ يا مَنْ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُنْ لَهُ كُفُواً اَحَدٌ",
                    german: "o Jener, Der urteilt, über Ihn aber nicht geurteilt wird, o Jener, Der nicht zeugt und nicht gezeugt worden ist, und Ihm ebenbürtig ist keiner.",
                    slideNumber: "50"
                },
                {
                    arabic: "يا نِعْمَ الْحَسيبُ يا نِعْمَ الطَّبيبُ يا نِعْمَ الرَّقيبُ يا نِعْمَ الْقَريبُ يا نِعْمَ الْمـٌجيبُ",
                    german: "o vortrefflichster Abrechnender, o vortrefflichster Heiler, o vortrefflichster Beobachter, o vortrefflichster Naher, o vortrefflichster Erfüllender,",
                    slideNumber: "51"
                },
                {
                    arabic: "يا نِعْمَ الْحَبيبُ يا نِعْمَ الْكَفيلُ يا نِعْمَ الَوْكيلُ يا نِعْمَ الْمَوْلى يا نِعْمَ النَّصيرُ",
                    german: "o vortrefflichster Geliebter, o vortrefflichster Garant, o vortrefflichster Treuhänder, o vortrefflichster Gebieter, o vortrefflicher Beisteher.",
                    slideNumber: "51"
                },
                {
                    arabic: "يا سُرُورَ الْعارِفينَ يا مُنَى الْمحِبّينَ يا اَنيسَ الْمُريدينَ يا حَبيبَ التَّوّابينَ",
                    german: "o Freude der Erkennenden, o Endwunsch der Liebenden, o Vertrauter der Anstrebenden, o Geliebter der Reumütigen,",
                    slideNumber: "52"
                },
                {
                    arabic: "يا رازِقَ الْمُقِلّينَ يا رَجاءَ الْمُذْنِبينَ يا قُرَّةَ عَيْنِ الْعابِدينَ يا مُنَفِّسُ عَنِ الْمَكْرُوبينَ",
                    german: "o Ernährer der Besitzlosen, o Hoffnung der Sünder, o Augentrost der Anbetenden, o Erleichternder der Besorgten,",
                    slideNumber: "52"
                },
                {
                    arabic: "يا مُفَرِّجُ عَنِ الْمَغْمُومينَ يا اِلـهَ الاْوَّلينَ وَالآخِرينَ",
                    german: "o Erlöser der Bekümmerten, o Gott der Ersten und der Letzten.",
                    slideNumber: "52"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا رَبَّنا يا اِلهَنا يا سَيِّدَنا يا مَوْلانا",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o unser Herr, o unser Gott, o unser Meister, o unser Gebieter,",
                    slideNumber: "53"
                },
                {
                    arabic: "يا ناصِرَنا يا حافِظَنا يا دَليلَنا يا مُعينَنا يا حَبيبَنا يا طَبيبَنا",
                    german: "o unser Unterstützer, o unser Behüter, o unser Wegweiser, o unser Helfer, o unser Liebling, o unser Heiler.",
                    slideNumber: "53"
                },
                {
                    arabic: "يا رَبَّ النَّبيّينَ وَالاْبْرارِ يا رَبَّ الصِّدّيقينَ وَالاْخْيارِ يا رَبَّ الْجَنَّةِ وَالنّارِ",
                    german: "o Herr der Propheten und der Rechtschaffenen, o Herr der Wahrheitsliebenden und der Auserwählten, o Herr des Paradieses und der Hölle",
                    slideNumber: "54"
                },
                {
                    arabic: "يا رَبَّ الصِّغارِ وَالْكِبارِ يا رَبَّ الْحُبُوبِ وَالِّثمارِ يا رَبَّ الاْنْهارِ وَالاْشْجار",
                    german: "o Herr der Kleinen und der Großen, o Herr der Samenkörner und der Früchte, o Herr der Flüsse und der Bäume",
                    slideNumber: "54"
                },
                {
                    arabic: "يا رَبَّ الصَّحاري وَالْقِفارِ يا رَبَّ الْبَراري وَالْبِحار",
                    german: "o Herr der Wüsten und der Steppen, o Herr des Festlandes und der Meere,",
                    slideNumber: "54"
                },
                {
                    arabic: "يا رَبَّ اللَّيْلِ وَالنَّهارِ يا رَبَّ الاْعْلانِ وَالاْسْرارِ",
                    german: "o Herr der Nacht und des Tages, o Herr des Offengelegten und des Geheimen.",
                    slideNumber: "54"
                },
                {
                    arabic: "يا مَنْ نَفَذَ في كُلِّ شَيْءٍ اَمْرُهُ يا مَنْ لَحِقَ بِكُلِّ شَيْءٍ عِلْمُهُ يا مَنْ بَلَغَتْ اِلى كُلِّ شَيْءٍ قُدْرَتُهُ",
                    german: "o Jener, Dessen Befehl alles unterliegt, o Jener, Dessen Wissen alles umfasst, o Jener, Dessen Macht an alles heranreicht,",
                    slideNumber: "55"
                },
                {
                    arabic: "يا مَنْ لا تُحْصِي الْعِبادُ نِعَمَهُ يا مَنْ لا تَبْلُغُ الْخَلائِقُ شُكْرَهُ يا مَنْ لا تُدْرِكُ الاْفْهامُ جَلالَهُ",
                    german: "o Jener, Dessen Gunst die Diener nicht ermessen können, o Jener, Dessen Dank die Geschöpfe nicht erlangen können, o Jener, Dessen Pracht das Begriffsvermögen nicht erfassen kann,",
                    slideNumber: "55"
                },
                {
                    arabic: "يا مَنْ لا تَرُدُّ الْعِبادُ قَضاءَهُ يا مَنْ لا مُلْكَ إلاّ مُلْكُهُ يا مَنْ لا عَطاءَ إلاّ عَطاؤُهُ",
                    german: "o Jener, Dessen Richtspruch die Diener nicht abwenden können, o Jener, außer Dessen Herrschaft es keine Herrschaft gibt, o Jener, außer Dessen Gaben es keine Gaben gibt.",
                    slideNumber: "55"
                },
                {
                    arabic: "يا مَنْ لَهُ الْمَثَلُ الاْعْلى يا مَنْ لَهُ الصِّفاتُ الْعُلْيا يا مَنْ لَهُ الاْخِرَةُ وَالاْولى",
                    german: "o Jener, Dem die höchsten Ideale gehören, o Jener, Dem die höchsten Eigenschaften gehören, o Jener, Dem das Jenseits und das Diesseits gehören,",
                    slideNumber: "56"
                },
                {
                    arabic: "يا مَنْ لَهُ الْجَنَّةُ الْمَأوى يا مَنْ لَهُ الآياتُ الْكُبْرى يا مَنْ لَهُ الاْسْماءُ الْحُسْنى",
                    german: "o Jener, Dem die Behausungen des Paradieses gehören, o Jener, Dem die größten Zeichen gehören, o Jener, Dem die schönsten Namen gehören,",
                    slideNumber: "56"
                },
                {
                    arabic: "يا مَنْ لَهُ الْحُكْمُ وَالْقَضاءُ يا مَنْ لَهُ الْهَواءُ وَالْفَضاءُ يا مَنْ لَهُ الْعَرْشُ وَالثَّرى يا مَنْ لَهُ السَّماواتُ الْعُلى",
                    german: "o Jener, Dem das Urteil und der Richtspruch gehören, o Jener, Dem die Atmosphäre und der Weltraum gehören, o Jener, Dem der Thron und die Erde gehören, o Jener, Dem die höchsten Himmel gehören.",
                    slideNumber: "56"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا عَفُوُّ يا غَفُورُ يا صَبُورُ يا شَكُورُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Vergebender, o Verzeihender, o Geduldiger, o Dankbarer,",
                    slideNumber: "57"
                },
                {
                    arabic: "يا رَؤوفُ يا عَطُوفُ يا مَسْؤولُ يا وَدُودُ يا سُبُّوحُ يا قُدُّوسُ",
                    german: "o Gnädiger, o Nachsichtiger, o Verantwortlicher, o Liebevoller, o Lobgepriesenster, o Heiligster.",
                    slideNumber: "57"
                },
                {
                    arabic: "يا مَنْ فِي السَّماءِ عَظَمَتُهُ يا مَنْ فِي الاْرْضِ آياتُهُ يا مَنْ في كُلِّ شَيْءٍ دَلائِلُهُ",
                    german: "o Jener, Dessen Gewaltigkeit im Himmel offenbar wird, o Jener, Dessen Zeichen auf der Erde sind, o Jener, Dessen Beweise in allem offenbar sind,",
                    slideNumber: "58"
                },
                {
                    arabic: "يا مَنْ فِي الْبِحارِ عَجائِبُهُ يا مَنْ فِي الْجِبالِ خَزائِنُهُ يا مَنْ يَبْدَأُ الْخَلْقَ ثُمَّ يُعيدُهُ",
                    german: "o Jener, Dessen Wunder in den Meeren sind, o Jener, Dessen Schatztruhen in den Bergen sind, o Jener, Der die Schöpfung erschafft und sie dann zurückkehren lässt,",
                    slideNumber: "58"
                },
                {
                    arabic: "يا مَنْ اِلَيْهِ يَرْجِـعُ الاْمْرُ كُلُّهُ يا مَنْ اَظْهَرَ في كُلِّ شَيْءٍ لُطْفَهُ",
                    german: "o Jener, auf Den die ganze Befehlsgewalt zurückgeht, o Jener, Dessen Nachsicht sich in allem zeigt,",
                    slideNumber: "58"
                },
                {
                    arabic: "يا مَنْ اَحْسَنَ كُلَّ شَيْءٍ خَلْقَهُ يا مَنْ تَصَرَّفَ فِي الْخَلائِقِ قُدْرَتُهُ",
                    german: "o Jener, Der alles in seiner Schöpfung schön gemacht hat, o Jener, Dessen Macht frei über die Geschöpfe verfügt.",
                    slideNumber: "58"
                },
                {
                    arabic: "يا حَبيبَ مَنْ لا حَبيبَ لَهُ يا طَبيبَ مَنْ لا طَبيبَ لَهُ يا مُجيبَ مَنْ لا مُجيبَ لَهُ",
                    german: "o Geliebter dessen, der keinen Geliebten hat, o Heiler dessen, der keinen Heiler hat, o Erfüllender dessen, der keinen Erfüllenden hat,",
                    slideNumber: "59"
                },
                {
                    arabic: "يا شَفيقَ مَنْ لا شَفيقَ لَهُ يا رَفيقَ مَنْ لا رَفيقَ لَهُ يا مُغيثَ مَن لا مُغيثَ لَهُ",
                    german: "o Mitleidiger dessen, der keinen Mitleidigen hat, o Begleiter dessen, der keinen Begleiter hat, o Retter dessen, der keinen Retter hat,",
                    slideNumber: "59"
                },
                {
                    arabic: "يا دَليلَ مَنْ لا دَليلَ لَهُ يا اَنيسَ مَنْ لا اَنيسَ لَهُ",
                    german: "o Wegweiser dessen, der keinen Wegweiser hat, o Tröster dessen, der keinen Tröster hat,",
                    slideNumber: "59"
                },
                {
                    arabic: "يا راحِمَ مَنْ لا راحِمَ لَهُ يا صاحِبَ مَنْ لا صاحِبَ لَهُ",
                    german: "o Erbarmer dessen, der keinen Erbarmer hat, o Gefährte dessen, der keinen Gefährten hat.",
                    slideNumber: "59"
                },
                {
                    arabic: "يا كافِيَ مَنِ اسْتَكْفاهُ يا هادِيَ مَنِ اسْتَهْداهُ يا كالِىءَ مَنِ اسْتَكْلاهُ",
                    german: "o Genügender dessen, der Ihn um Genüge bittet, o Wegweiser dessen, der Ihn um Wegweisung bittet, o Beschützer dessen, der Ihn um Schutz bittet,",
                    slideNumber: "60"
                },
                {
                    arabic: "يا راعِيَ مَنِ اسْتَرْعاهُ يا شافِيَ مَنِ اسْتَشْفاهُ يا قاضِيَ مَنِ اسْتَقْضاهُ",
                    german: "o Behüter dessen, der Ihn um Behütung bittet, o Heiler dessen, der Ihn um Heilung bittet, o Richter dessen, der Ihn um Richtspruch bittet",
                    slideNumber: "60"
                },
                {
                    arabic: "يا مُغْنِيَ مَنِ اسْتَغْناهُ يا مُوفِيَ مَنِ اسْتَوْفاهُ يا مُقَوِّيَ مَنِ اسْتَقْواهُ يا وَلِيَّ مَنِ اسْتَوْلاهُ",
                    german: "o Bereichernder dessen, der Ihn um Reichtum bittet, o reich Beschenkender dessen, der Ihn um reiche Schenkung bittet, o Stärkender dessen, der Ihn um Stärkung bittet, o Beistand dessen, der Ihn um Beistand bittet.",
                    slideNumber: "60"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا خالِقُ يا رازِقُ يا ناطِقُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Schöpfer, o Versorger, o Erlassender,",
                    slideNumber: "61"
                },
                {
                    arabic: "يا صادِقُ يا فالِقُ يا فارِقُ يا فاتِقُ يا راتِقُ يا سابِقُ يا سامِقُ",
                    german: "o Wahrhaftiger, o Aufspaltender, o Unterscheider, o Trennender, o Aufreißender, o Vorangehender, o Hochragender.",
                    slideNumber: "61"
                },
                {
                    arabic: "يا مَنْ يُقَلِّبُ اللَّيْلَ وَالنَّهارَ يا مَنْ جَعَلَ الظُّلُماتِ وَالأَنْوارَ يا مَنْ خَلَقَ الظِّلَّ وَالْحَرُورَ",
                    german: "o Jener, Der die Nacht und den Tag einander abwechseln lässt, o Jener, Der die Dunkelheit und das Licht erschuf, o Jener, Der die Schatten und die Hitze hervorbrachte,",
                    slideNumber: "62"
                },
                {
                    arabic: "يا مَنْ سَخَّرَ الشَّمْسَ وَالْقَمَرَ يا مَنْ قَدَّرَ الْخَيْرَ وَالشَّرَّ يا مَنْ خَلَقَ الْمَوْتَ وَالْحَياةَ",
                    german: "o Jener, Der die Sonne und den Mond dienstbar machte, o Jener, Der das Gute und das Schlechte bemessen hat, o Jener, Der den Tod und das Leben erschuf,",
                    slideNumber: "62"
                },
                {
                    arabic: "يا مَنْ لَهُ الْخَلْقُ وَالاْمْرُ يا مَنْ لَمْ يَتَّخِذْ صاحِبَةً وَلا وَلَداً",
                    german: "o Jener, Dem die Schöpfung und die Befehlsgewalt gehören, o Jener, Der Sich weder Gefährtin noch ein Kind nimmt,",
                    slideNumber: "62"
                },
                {
                    arabic: "يا مَنْ لَيْسَ لَهُ شَريكٌ في الْمُلْكِ يا مَنْ لَمْ يَكُنْ لَهُ وَلِيٌّ مِنَ الذُّلِّ",
                    german: "o Jener, Der keinen Partner bei der Herrschaft hat, o Jener, Der keinen Gebieter hat, der Ihn vor Demütigung bewahrt.",
                    slideNumber: "62"
                },
                {
                    arabic: "يا مَنْ يَعْلَمُ مُرادَ الْمُريدينَ يا مَنْ يَعْلَمُ ضَميرَ الصّامِتينَ يا مَنْ يَسْمَعُ اَنينَ الْواهِنينَ",
                    german: "o Jener, Der das Ziel der Anstrebenden kennt, o Jener, Der das Innere der Schweigenden kennt, o Jener, Der das Leiden der Geschwächten hört,",
                    slideNumber: "63"
                },
                {
                    arabic: "يا مَنْ يَرى بُكاءَ الْخائِفينَ يا مَنْ يَمْلِكُ حَوائِجَ السّائِلينَ يا مَنْ يَقْبَلُ عُذْرَ التّائِبينَ",
                    german: "o Jener, Der das Weinen der Verängstigten sieht, o Jener, Der das Anliegen der Bittenden besitzt, o Jener, Der die Entschuldigung der Reumütigen annimmt,",
                    slideNumber: "63"
                },
                {
                    arabic: "يا مَنْ لا يُصْلِحُ عَمَلَ الْمُفْسِدينَ يا مَنْ لا يُضيعُ اَجْرَ الْمـٌحْسِنينَ",
                    german: "o Jener, Der die Taten der Verderber nicht gelingen lässt, o Jener, Der die Werke der Rechtschaffenen nicht verkommen lässt,",
                    slideNumber: "63"
                },
                {
                    arabic: "يا مَنْ لا يَبْعُدُ عَنْ قُلُوبِ الْعارِفينَ يا اَجْوَدَ الاْجْودينَ",
                    german: "o Jener, Der sich von den Herzen der Erkennenden nicht entfernt, o Großzügigster der Großzügigen.",
                    slideNumber: "63"
                },
                {
                    arabic: "يا دائِمَ الْبَقاءِ يا سامِعَ الدُّعاءِ يا واسِعَ الْعَطاءِ يا غافِرَ الْخَطاءِ",
                    german: "o Dessen Ewigkeit immer währt, o Erhörer des Bittgebets, o Dessen Gaben reichlich sind, o Verzeihender der Fehler,",
                    slideNumber: "64"
                },
                {
                    arabic: "يا بَديعَ السَّماءِ يا حَسَنَ الْبَلاءِ يا جَميلَ الثَّناءِ يا قَديمَ السَّناءِ",
                    german: "o Schöpfer des Himmels, o Dessen Prüfung gut ist, o Dessen Lob schön ist, o Dessen Glanz von je her besteht,",
                    slideNumber: "64"
                },
                {
                    arabic: "يا كَثيرَ الْوَفاءِ يا شَريفَ الْجَزاء",
                    german: "o Dessen Treue groß ist, o Dessen Belohnung ehrenhaft ist.",
                    slideNumber: "64"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا سَتّارُ يا غَفّارُ يا قَهّارُ",
                    german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Verhüller, o Verzeihender, o Bezwinger, o Allgewaltiger,",
                    slideNumber: "65"
                },
                {
                    arabic: "يا جَبّارُ يا صَبّارُ يا بارُّ يا مُخْتارُ يا فَتّاحُ يا نَفّاحُ يا مُرْتاحُ",
                    german: "o Langmütiger, o Gütiger, o Auserwählender, o Eröffnender, o Beschenkender, o Zufriedener.",
                    slideNumber: "65"
                },
                {
                    arabic: "يا مَنْ خَلَقَني وَسَوّاني يا مَنْ رَزَقَني وَرَبّاني يا مَنْ اَطْعَمَني وَسَقاني",
                    german: "o Jener, Der mich erschaffen und geformt hat, o Jener, Der mich versorgt und aufgezogen hat o Jener, Der mich mit Speisen und Getränken versorgt hat,",
                    slideNumber: "66"
                },
                {
                    arabic: "يا مَنْ قَرَّبَني وَ اَدْناني يا مَنْ عَصَمَني وَكَفاني يا مَنْ حَفِظَني وَكَلاني",
                    german: "o Jener, Der mich angenähert und herangerückt hat, o Jener, Der mich beschützt und Genüge getan hat, o Jener, Der mich behütet und bewahrt hat,",
                    slideNumber: "66"
                },
                {
                    arabic: "يا مَنْ اَعَزَّني وَاَغْناني يا مَنْ وَفَّقَني وَهَداني يا مَنْ آنَسَني وَآوَاني يا مَنْ اَماتَني وَاَحْياني",
                    german: "o Jener, Der mich gestärkt und bereichert hat, o Jener, Der mir Erfolg geschenkt und rechtgeleitet hat, o Jener, Der mich getröstet und mir Unterkunft gewährt hat, o Jener, Der mich sterben Und wieder leben lässt.",
                    slideNumber: "66"
                },
                {
                    arabic: "يا مَنْ يُحِقُّ الْحَقَّ بِكَلِماتِهِ يا مَنْ يَقْبَلُ التَّوْبَةَ عَنْ عِبادِهِ يا مَنْ يَحُولُ بَيْنَ الْمَرْءِ وَقَلْبِهِ",
                    german: "o Jener, Der mit Seinen Worten die Wahrheit bestätigt, o Jener, Der die Reue Seiner Diener annimmt, o Jener, Der zwischen dem Menschen und seinem Herzen steht,",
                    slideNumber: "67"
                },
                {
                    arabic: "يا مَنْ لا تَنْفَعُ الشَّفاعَةُ إلاّ بِاِذْنِهِ يا مَنْ هُوَ اَعْلَمُ بِمَنْ ضَلَّ عَنْ سَبيلِهِ يا مَنْ لا مُعَقِّبَ لِحُكْمِهِ",
                    german: "o Jener, ohne Dessen Erlaubnis keine Fürsprache Erfolg hat, o Jener, Der am besten weiß über jene, die von Seinem Weg abgewichen sind, o Jener, Dessen Urteil nicht zurückgewiesen werden kann",
                    slideNumber: "67"
                },
                {
                    arabic: "يا مَنْ لا رادَّ لِقَضائِهِ يا مَنِ انْقادَ كُلُّ شَيْءٍ لأَمْرِهِ",
                    german: "o Jener, Dessen Richtspruch nicht in Frage gestellt werden kann, o Jener, Dessen Befehl alles unterlegen ist,",
                    slideNumber: "67"
                },
                {
                    arabic: "يا مَنِ السَّماواتُ مَطْوِيّاتٌ بِيَمينِهِ يا مَنْ يُرْسِلُ الرِّياحَ بُشْراً بَيْنَ يَدَيْ رَحْمَتِهِ",
                    german: "o Jener, in Dessen Rechter die Himmel zusammengelegt sind, o Jener, Der die Winde als Vorboten Seiner Gnade bei Ihm schickt.",
                    slideNumber: "67"
                },
                {
                    arabic: "يا مَنْ جَعَلَ الاْرْضَ مِهاداً يا مَنْ جَعَلَ الْجِبالَ اَوْتاداً يا مَنْ جَعَلَ الشَّمْسَ سِراجاً",
                    german: "o Jener, Der die Erde ausgewogen errichtet hat, o Jener, Der die Berge zu Pflöcken errichtet hat, o Jener, Der die Sonne zu einer Leuchte errichtet hat,",
                    slideNumber: "68"
                },
                {
                    arabic: "يا مَنْ جَعَلَ الْقَمَرَ نُوراً يا مَنْ جَعَلَ اللَّيْلَ لِباساً يا مَنْ جَعَلَ النَّهارَ مَعاشاً",
                    german: "o Jener, Der den Mond zum Licht errichtet hat, o Jener, Der die Nacht zu einem Gewand errichtet hat, o Jener, Der den Tag zum Zusammenleben errichtet hat,",
                    slideNumber: "68"
                },
                {
                    arabic: "يا مَنْ جَعَلَ النَّوْمَ سُباتاً يا مَنْ جَعَلَ السَّمآءَ بِناءً يا مَنْ جَعَلَ الاْشْياءَ اَزْواجاً يا مَنْ جَعَلَ النّارَ مِرْصاداً",
                    german: "o Jener, Der den Schlaf zum Ausruhen errichtet hat, o Jener, Der den Himmel zum Erbauten errichtet hat, o Jener, Der die Dinge als Paare errichtet hat, o Jener, Der das Feuer zu einer Wacht errichtet hat.",
                    slideNumber: "68"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا سَميعُ يا شَفيعُ يا رَفيعُ",
                    german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Allhörender, o Fürsprecher, o Angesehener,",
                    slideNumber: "69"
                },
                {
                    arabic: "يا مَنيعُ يا سَريعُ يا بَديعُ يا كَبيرُ يا قَديرُ يا خَبيرُ يا مُجيرُ",
                    german: "o Unüberwindlicher, o Zügiger, o Glanzvoller, o Großer, o Mächtiger o Kundiger, o Schutzgewährender.",
                    slideNumber: "69"
                },
                {
                    arabic: "يا حَيّاً قَبْلَ كُلِّ حَيٍّ يا حَيّاً بَعْدَ كُلِّ حَيٍّ يا حَيُّ الَّذي لَيْسَ كَمِثْلِهِ حَيٌّ",
                    german: "o Lebender vor allen Lebewesen, o Lebender nach allen Lebewesen, o Lebender, Dem kein Lebewesen gleicht,",
                    slideNumber: "70"
                },
                {
                    arabic: "يا حَيُّ الَّذي لا يُشارِكُهُ حَيٌّ يا حَيُّ الَّذي لا يَحْتاجُ اِلى حَيٍّ يا حَيُّ الَّذي يُميتُ كُلَّ حَيٍّ",
                    german: "o Lebender, Der kein Lebewesen als Partner hat, o Lebender, Der auf kein Lebewesen angewiesen ist, o Lebender, Der alle Lebewesen sterben lässt,",
                    slideNumber: "70"
                },
                {
                    arabic: "يا حَيُّ الَّذي يَرْزُقُ كُلَّ حَيٍّ يا حَيّاً لَمْ يَرِثِ الْحَياةَ مِنْ حَيٍّ يا حَيُّ الَّذي يُحْيِي الْمَوْتى يا حَيُّ يا قَيُّومُ لا تَأخُذُهُ سِنَةٌ وَلا نَوْمٌ",
                    german: "o Lebender, Der alle Lebewesen versorgt, o Lebender, Der das Leben von keinem Lebewesen geerbt bekommen hat, o Lebender, Der die Toten wieder zum Leben erweckt, o Lebender, o Beständiger, Ihn überkommt weder Schlummer noch Schlaf.",
                    slideNumber: "70"
                },
                {
                    arabic: "يا مَنْ لَهُ ذِكْرٌ لا يُنْسى يا مَنْ لَهُ نُورٌ لا يُطْفَأُ يا مَنْ لَهُ نِعَمٌ لا تُعَدُّ",
                    german: "o Jener, Dessen Erwähnung unvergesslich ist, o Jener, Dessen Licht unauslöschlich ist, o Jener, Dessen Gaben unzählbar sind,",
                    slideNumber: "71"
                },
                {
                    arabic: "يا مَنْ لَهُ مُلْكٌ لا يَزُولُ يا مَنْ لَهُ ثَناءٌ لا يُحْصى يا مَنْ لَهُ جَلالٌ لا يُكَيَّفُ",
                    german: "o Jener, Dessen Herrschaft unvergänglich ist, o Jener, Dessen Lob nicht auf zählbar ist, o Jener, Dessen Herrlichkeit unbeschreibbar ist,",
                    slideNumber: "71"
                },
                {
                    arabic: "يا مَنْ لَهُ كَمالٌ لا يُدْرَكُ يا مَنْ لَهُ قَضاءٌ لا يُرَدُّ يا مَنْ لَهُ صِفاتٌ لا تُبَدَّلُ يا مَنْ لَهُ نُعُوتٌ لا تُغَيَّرُ",
                    german: "o Jener, Dessen Vollkommenheit unvorstellbar ist, o Jener, Dessen Urteil nicht zurückzuweisen ist, o Jener, Dessen Eigenschaften unersetzbar sind, o Jener, Dessen Attribute unveränderlich sind.",
                    slideNumber: "71"
                },
                {
                    arabic: "يا رَبَّ الْعالَمينَ يا مالِكَ يَوْمِ الدّينِ يا غايَةَ الطّالِبينَ",
                    german: "o Herr der Welten, o Herrscher des Jüngsten Tages, o Endziel der Anstrebenden,",
                    slideNumber: "72"
                },
                {
                    arabic: "يا ظَهْرَ اللاّجينَ يا مُدْرِكَ الْهارِبينَ يا مَنْ يُحِبُّ الصّابِرينَ",
                    german: "o Rückhalt der Zufluchtsuchenden, o Erfassender der Fliehenden, o Jener, Der die Geduldigen liebt",
                    slideNumber: "72"
                },
                {
                    arabic: "يا مَنْ يُحِبُّ التَّوّابينَ يا مَنْ يُحِبُّ الْمُتَطَهِّرينَ",
                    german: "o Jener, Der die Reumütigen liebt, o Jener, Der die sich Reinigenden liebt,",
                    slideNumber: "72"
                },
                {
                    arabic: "يا مَنْ يُحِبُّ الْمحْسِنينَ يا مَنْ هُوَ اَعْلَمُ بِالْمُهْتَدينَ",
                    german: "o Jener, Der die Wohltätigen liebt, o Jener, Der wissender ist über die Rechtgeleiteten.",
                    slideNumber: "72"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا شَفيقُ يا رَفيقُ يا حَفيظُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Erbarmer, o Milder, o Bewahrer,",
                    slideNumber: "73"
                },
                {
                    arabic: "يا مُحيطُ يا مُقيتُ يا مُغيثُ يا مُعِزُّ يا مُذِلُّ يا مُبْدِئُ يا مُعيدُ",
                    german: "o Umfassender, o Ernährer, o Rettungsgewährender o Ehrender, o Demütigender, o Urheber, o Wiederherstellender.",
                    slideNumber: "73"
                },
                {
                    arabic: "يا مَنْ هُوَ اَحَدٌ بِلا ضِدٍّ يا مَنْ هُوَ فَرْدٌ بِلا نِدٍّ يا مَنْ هُوَ صَمَدٌ بِلا عَيْبٍ",
                    german: "o Jener, Der ein Einziger ohne Gegner ist, o Jener, Der ein Einzelner ohne Rivale ist, o Jener, Der ein Unabhängiger ohne Makel ist,",
                    slideNumber: "74"
                },
                {
                    arabic: "يا مَنْ هُوَ وِتْرٌ بِلا كَيْفٍ يا مَنْ هُوَ قاضٍ بِلا حَيْفٍ يا مَنْ هُوَ رَبٌّ بِلا وَزيرٍ",
                    german: "o Jener, Der ein unbeschreibbarer Einmaliger ist, o Jener, Der ein Richter ist ohne Ungerechtigkeit, o Jener, Der ein Herr ohne Berater ist,",
                    slideNumber: "74"
                },
                {
                    arabic: "يا مَنْ هُوَ عَزيزٌ بِلا ذُلٍّ يا مَنْ هُوَ غَنِيٌّ بِلا فَقْرٍ",
                    german: "o Jener, Der ein Mächtiger ohne Schwäche ist o Jener, Der reich ist ohne Bedürftigkeit,",
                    slideNumber: "74"
                },
                {
                    arabic: "يا مَنْ هُوَ مَلِكٌ بِلا عَزْلٍ يا مَنْ هُوَ مَوْصُوفٌ بِلا شَبيهٍ",
                    german: "o Jener, Der unabsetzbarer Herrscher ist, o Jener, Der ohne einen Ähnlichen beschrieben wird.",
                    slideNumber: "74"
                },
                {
                    arabic: "يا مَنْ ذِكْرُهُ شَرَفٌ لِلذّاكِرينَ يا مَنْ شُكْرُهُ فَوْزٌ لِلشّاكِرينَ يا مَنْ حَمْدُهُ عِزٌّ لِلْحامِدينَ",
                    german: "o Jener, Dessen Erwähnung Ehre für die Erwähnenden ist, o Jener, Dessen Dank Triumph für die Dankbaren ist, o Jener, Dessen Lob Stärkung für die Lobpreisenden ist,",
                    slideNumber: "75"
                },
                {
                    arabic: "يا مَنْ طاعَتُهُ نَجاةٌ لِلْمُطيعينَ يا مَنْ بابُهُ مَفْتُوحٌ لِلطّالِبينَ يا مَنْ سَبيلُهُ واضِحٌ لِلْمُنيبينَ",
                    german: "o Jener, Dessen Gehorsam Ihm gegenüber für die Gehorsamen Rettung ist, o Jener, Dessen Tür den Wünschenden offen steht, o Jener, Dessen Weg für die Reuenden klar erkennbar ist,",
                    slideNumber: "75"
                },
                {
                    arabic: "يا مَنْ آياتُهُ بُرْهانٌ لِلنّاظِرينَ يا مَنْ كِتابُهُ تَذْكِرَةٌ لِلْمُتَّقينَ",
                    german: "o Jener, Dessen Zeichen den Schauenden Beweis sind, o Jener, Dessen Buch eine Erinnerung für die Frommen ist,",
                    slideNumber: "75"
                },
                {
                    arabic: "يا مَنْ رِزْقُهُ عُمُومٌ لِلطّائِعينَ وَالْعاصينَ يا مَنْ رَحْمَتُهُ قَريبٌ مِنَ الْمحْسِنينَ",
                    german: "o Jener, Dessen Versorgung für die Gehorsamen und die Ungehorsamen ist, o Jener, Dessen Gnade den Wohltätigen nahe ist.",
                    slideNumber: "75"
                },
                {
                    arabic: "يا مَنْ تَبارَكَ اسْمُهُ يا مَنْ تَعالى جَدُّهُ يا مَنْ لا اِلـهَ غَيْرُهُ",
                    german: "o Jener, Dessen Name gesegnet ist, o Jener, Dessen Stellung gehoben ist, o Jener, außer Dem es keine Gottheit gibt,",
                    slideNumber: "76"
                },
                {
                    arabic: "يا مَنْ جَلَّ ثَناؤُهُ يا مَنْ تَقَدَّسَتَ اَسْماؤُهُ يا مَنْ يَدُومُ بَقاؤُهُ",
                    german: "o Jener, Dessen Lobpreisung erhaben ist, o Jener, Dessen Namen heilig sind, o Jener, Dessen Beständigkeit ewig währt",
                    slideNumber: "76"
                },
                {
                    arabic: "يا مَنِ الْعَظَمَةُ بَهاؤُهُ يا مَنِ الْكِبْرِياءُ رِداؤُهُ يا مَنْ لا تُحْصى الاؤُهُ يا مَنْ لا تُعَدُّ نَعْماؤُه",
                    german: "o Jener, Dessen Größe Sein Glanz ist, o Jener, Dessen Herrlichkeit sein Gewand ist, o Jener, Dessen Wohltaten unermesslich sind, o Jener, Dessen Gaben unzählbar sind.",
                    slideNumber: "76"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُعينُ يا اَمينُ يا مُبينُ يا مَتينُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Helfer, o Vertrauenswürdiger, o Deutlicher, o Starker,",
                    slideNumber: "77"
                },
                {
                    arabic: "يا مَكينُ يا رَشيدُ يا حَميدُ يا مَجيدُ يا شَديدُ يا شَهيدُ",
                    german: "o Gewalthabender, o Bedachter, o Lobenswerter, o Ruhmreicher, o Strenger, o Zeuge.",
                    slideNumber: "77"
                },
                {
                    arabic: "يا ذَا الْعَرْشِ الْمجيدِ يا ذَا الْقَوْلِ السَّديدِ يا ذَا الْفِعْلِ الرَّشيدِ",
                    german: "O Dem der ruhmreiche Thron gehört, o Dem die treffende Rede gehört, o Dem die bedachte Handlung gehört,",
                    slideNumber: "78"
                },
                {
                    arabic: "يا ذَا الْبَطْشِ الشَّديدِ يا ذَا الْوَعْدِ وَالْوَعيدِ يا مَنْ هُوَ الْوَلِيُّ الْحَميدُ",
                    german: "o Dem die strenge Gewalt gehört, o Dem das Versprechen und die Drohung gehören, o Der lobenswerter Gebieter ist",
                    slideNumber: "78"
                },
                {
                    arabic: "يا مَنْ هُوَ فَعّالٌ لِما يُريدُ يا مَنْ هُوَ قَريبٌ غَيْرُ بَعيدٍ",
                    german: "o Der das tut, was Er will, o Naher, Der nicht fern ist,",
                    slideNumber: "78"
                },
                {
                    arabic: "يا مَنْ هُوَ عَلى كُلِّ شَيْءٍ شَهيدٌ يا مَنْ هُوَ لَيْسَ بِظَلاّمٍ لِلْعَبيدِ",
                    german: "o Der Zeuge aller Dinge ist, o Der Seinen Dienern gegenüber niemals ungerecht ist.",
                    slideNumber: "78"
                },
                {
                    arabic: "يا مَنْ لا شَريكَ لَهُ وَلا وَزيرَ يا مَنْ لا شَبيهَ لَهُ وَلا نَظيرَ يا خالِقَ الشَّمْسِ وَالْقَمَرِ الْمُنيرِ",
                    german: "o Jener, Der weder Partner noch Berater hat, o Jener, Dem nichts gleich oder ähnlich ist, o Schöpfer der Sonne und des leuchtenden Mondes,",
                    slideNumber: "79"
                },
                {
                    arabic: "يا مُغْنِيَ الْبائِسِ الْفَقيرِ يا رازِقَ الْطِّفْلِ الصَّغيرِ يا راحِمَ الشَّيْخِ الْكَبيرِ",
                    german: "o Der, Der die unglücklichen Armen reich macht, o Versorger des kleinen Kindes, o Erbarmer des alten Menschen,",
                    slideNumber: "79"
                },
                {
                    arabic: "يا جابِرَ الْعَظْمِ الْكَسيرِ يا عِصْمَةَ الْخآئِفِ الْمُسْتَجيرِ",
                    german: "o Einrenkender des gebrochenen Knochens, o Beschützer des ängstlich Hilfesuchenden,",
                    slideNumber: "79"
                },
                {
                    arabic: "يا مَنْ هُوَ بِعِبادِهِ خَبيرٌ بَصيرٌ يا مَنْ هُوَ عَلى كُلِّ شَيْءٍ قَديرٌ",
                    german: "o Jener, Der erfahren und allsehend über Seine Diener ist, o Jener, Der zu allem fähig ist.",
                    slideNumber: "79"
                },
                {
                    arabic: "يا ذَا الْجُودِ وَالنِّعَمِ يا ذَا الْفَضْلِ وَالْكَرَمِ يا خالِقَ اللَّوْحِ وَالْقَلَمِ",
                    german: "Oh, Eigner der Großzügigkeit und der Gaben, o Eigner der Gunst und der Großzügigkeit, o Schöpfer der Tafel und des Stifts,",
                    slideNumber: "80"
                },
                {
                    arabic: "يا بارِئَ الذَّرِّ وَالنَّسَمِ يا ذَا الْبَأْسِ وَالنِّقَمِ يا مُلْهِمَ الْعَرَبِ وَالْعَجَمِ",
                    german: "o Du Schöpfer der Atome und des beseelten Lebens, o Eigner des Peins und der Vergeltung, o Der Araber wie Nichtaraber inspiriert",
                    slideNumber: "80"
                },
                {
                    arabic: "يا كاشِفَ الضُّرِّ وَالألَمِ يا عالِمَ السِّرِّ وَالْهِمَمِ",
                    german: "o Der Schaden und Schmerz beseitigt, o Der Geheimnisse und Absichten kennt,",
                    slideNumber: "80"
                },
                {
                    arabic: "يا رَبَّ الْبَيْتِ وَالْحَرَمِ يا مَنْ خَلَقَ الاْشياءَ مِنَ الْعَدَمِ",
                    german: "o Der Herr des Hauses und der Heiligen Stätte ist, o Der die Dinge aus dem Nichts heraus erschaffen hat.",
                    slideNumber: "80"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا فاعِلُ يا جاعِلُ يا قابِلُ",
                    german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Handelnder, o Hervorbringender, o Annehmer,",
                    slideNumber: "81"
                },
                {
                    arabic: "يا كامِلُ يا فاصِلُ يا واصِلُ يا عادِلُ يا غالِبُ يا طالِبُ يا واهِبُ",
                    german: "o Vollkommener, o Aburteilender, o Beschenkender, o Gerechter, o Besiegender, o Verlangender, o Spender.",
                    slideNumber: "81"
                },
                {
                    arabic: "يا مَنْ اَنْعَمَ بِطَوْلِهِ يا مَنْ اَكْرَمَ بِجُودِهِ يا مَنْ جادَ بِلُطْفِهِ",
                    german: "o Jener, Der mit Seiner Macht Wohltaten erwies, o Jener, Der mit Seiner Güte Großzügigkeit erwies, o Jener, Der mit Seiner Nachsicht Güte erwies,",
                    slideNumber: "82"
                },
                {
                    arabic: "يا مَنْ تَعَزَّزَ بِقُدْرَتِهِ يا مَنْ قَدَّرَ بِحِكْمَتِهِ يا مَنْ حَكَمَ بِتَدْبيرِهِ",
                    german: "o Jener, Der mit Seiner Fähigkeit mächtig war, o Jener, Der mit Seiner Weisheit bewertete, o Jener, Der nach Seinen Maßnahmen regierte,",
                    slideNumber: "82"
                },
                {
                    arabic: "يا مَنْ دَبَّرَ بِعِلْمِهِ يا مَنْ تَجاوَزَ بِحِلْمِهِ يا مَنْ دَنا في عُلُوِّهِ يا مَنْ عَلا في دُنُوِّهِ",
                    german: "o Jener, Der nach Seinem Wissen Maßnahmen traf, o Jener, Der mit Seinem Langmut absah, o Jener, Der in Seiner Erhabenheit nah war, o Jener, Der mit Seiner Nähe erhaben war.",
                    slideNumber: "82"
                },
                {
                    arabic: "يا مَنْ يَخْلُقُ ما يَشاءُ يا مَنْ يَفْعَلُ ما يَشاءُ يا مَنْ يَهْدي مَنْ يَشاءُ",
                    german: "o Jener, Der schafft, was Er will, o Jener, Der tut, was Er will, o Jener, Der zum Rechten leitet, wen er will,",
                    slideNumber: "83"
                },
                {
                    arabic: "يا مَنْ يُضِلُّ مَنْ يَشاءُ يا مَنْ يُعَذِّبُ مَنْ يَشاءُ يا مَنْ يَغْفِرُ لِمَنْ يَشآءُ",
                    german: "o Jener, Der irregehen lässt, wen Er will, o Jener, Der bestraft, wen Er will, o Jener, Der verzeiht, wem Er will",
                    slideNumber: "83"
                },
                {
                    arabic: "يا مَنْ يُعِزُّ مَنْ يَشاءِ يا مَنْ يُذِلُّ مَنْ يَشاءُ",
                    german: "o Jener, Der stärkt, wen Er will, o Jener, Der demütigt, wen Er will.",
                    slideNumber: "83"
                },
                {
                    arabic: "يا مَنْ يُصَوِّرُ فِي الاْرْحامِ ما يَشاءُ يا مَنْ يَخْتَصُّ بِرَحْمَتِهِ مَنْ يَشاءُ",
                    german: "o Jener, Der im Mutterleib gestaltet, was Er will, o Jener, Der Sein Erbarmen schenkt, wem Er will.",
                    slideNumber: "83"
                },
                {
                    arabic: "يا مَنْ لَمْ يَتَّخِذْ صاحِبَةً وَلا وَلَداً يا مَنْ جَعَلَ لِكُلِّ شَيْءٍ قَدْراً يا مَنْ لا يُشْرِكُ في حُكْمِهِ اَحَداً",
                    german: "o Jener, Der sich weder Gattin noch Kind nahm, o Jener, Der allen Dingen ein Maß errichtet hat, o Jener, Der an Seiner Herrschaft niemanden teilhaben lässt,",
                    slideNumber: "84"
                },
                {
                    arabic: "يا مَنْ جَعَلَ الْمَلائِكَةَ رُسُلاً يا مَنْ جَعَلَ فِي السَّماءِ بُرُوجاً يا مَنْ جَعَلَ الاْرْضَ قَراراً",
                    german: "o Jener, Der die Engel zu Gesandten errichtet hat, o Jener, Der im Himmel Sternbilder errichtet hat, o Jener, Der die Erde zum festen Wohnsitz errichtet hat,",
                    slideNumber: "84"
                },
                {
                    arabic: "يا مَنْ خَلَقَ مِنَ الْماءِ بَشَراً يا مَنْ جَعَلَ لِكُلِّ شَيْءٍ اَمَداً",
                    german: "o Jener, Der Menschen aus Wasser erschaffen hat, o Jener, Der für alle Dinge eine Frist errichtet hat,",
                    slideNumber: "84"
                },
                {
                    arabic: "يا مَنْ اَحاطَ بِكُلِّ شَيْءٍ عِلْماً يا مَنْ اَحْصى كُلَّ شَيْءٍ عَدَدا",
                    german: "o Jener, Der alles mit Wissen umfasst, o Jener, Der die Anzahl von allem erfasst.",
                    slideNumber: "84"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَوَّلُ يا آخِرُ يا ظاهِرُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Erster, o Letzter, o Offenbarer,",
                    slideNumber: "85"
                },
                {
                    arabic: "يا باطِنُ يا بَرُّ يا حَقُّ يا فَرْدُ يا وِتْرُ يا صَمَدُ يا سَرْمَدُ",
                    german: "o Unsichtbarer, o Gütiger, o Rechtsschaffner, o Einziger, o Einzelner, o Unabhängiger, o Ewiger.",
                    slideNumber: "85"
                },
                {
                    arabic: "يا خَيْرَ مَعْرُوفٍ عُرِفَ يا اَفْضَلَ مَعْبُودٍ عُبِدَ يا اَجَلَّ مَشْكُورٍ شُكِرَ",
                    german: "o wohltätigster Bekannter, Der bekannt wurde, o gütigster Angebeteter, Der angebetet wurde, o majestätischster Gedankter, Dem gedankt wurde,",
                    slideNumber: "86"
                },
                {
                    arabic: "يا اَعَزَّ مَذْكُورٍ ذُكِرَ يا اَعْلى مَحْمُودٍ حُمِدَ يا اَقْدَمَ مَوْجُودٍ طُلِبَ",
                    german: "o mächtigster Erwähnter, Der erwähnt wurde, o höchster Gelobter, Der gelobt wurde, o ältester Existierender, Der angestrebt wurde,",
                    slideNumber: "86"
                },
                {
                    arabic: "يا اَرْفَعَ مَوْصُوفٍ وُصِفَ يا اَكْبَرَ مَقْصُودٍ قُصِدَ يا اَكْرَمَ مَسْؤولٍ سُئِلَ يا اَشْرَفَ مَحْبُوبٍ عُلِمَ",
                    german: "o angesehenster Beschriebener, Der beschrieben wurde, o größter Erstrebter, Der erstrebt wurde, o großzügigster Gefragter, Der gefragt wurde, o ruhmreichster Geliebter, Der gekannt worden ist.",
                    slideNumber: "86"
                },
                {
                    arabic: "يا حَبيبَ الْباكينَ يا سَيِّدَ الْمُتَوَكِّلينَ يا هادِيَ الْمُضِلّينَ",
                    german: "o Geliebter der Weinenden, o Herr der Vertrauenden, o Rechtleitender der Fehlgeleiteten,",
                    slideNumber: "87"
                },
                {
                    arabic: "يا وَلِيَّ الْمُؤْمِنينَ يا اَنيسَ الذّاكِرينَ يا مَفْزَعَ الْمَلْهُوفينَ",
                    german: "o Gebieter der Gläubigen, o Vertrauter der Erwähnenden, o Zuflucht der Hilfesuchenden,",
                    slideNumber: "87"
                },
                {
                    arabic: "يا مُنْجِيَ الصّادِقينَ يا اَقْدَرَ الْقادِرينَ يا اَعْلَمَ الْعالِمينَ يا اِلـهَ الْخَلْقِ اَجْمَعينَ",
                    german: "o Retter der Wahrhaftigen, o Mächtigster der Mächtigen, o Wissendster der Wissenden, o Gott der Geschöpfe allesamt.",
                    slideNumber: "87"
                },
                {
                    arabic: "يا مَنْ عَلا فَقَهَرَ يا مَنْ مَلَكَ فَقَدَرَ يا مَنْ بَطَنَ فَخَبَرَ",
                    german: "o Jener, Der höher ist und überwältigt hat, o Jener, Der herrscht und mächtig ist, o Jener, Der unsichtbar und erfahren ist,",
                    slideNumber: "88"
                },
                {
                    arabic: "يا مَنْ عُبِدَ فَشَكَرَ يا مَنْ عُصِيَ فَغَفَرَ يا مَنْ لا تَحْويهِ الْفِكَرُ",
                    german: "o Jener, Der angebetet wird und sich bedankt, o Jener, Dem Ungehorsam gezeigt wird und vergibt, o Jener, Der in den Gedanken nicht erfassbar ist,",
                    slideNumber: "88"
                },
                {
                    arabic: "يا مَنْ لا يُدْرِكُهُ بَصَرٌ يا مَنْ لا يَخْفى عَلَيْهِ اَثَرٌ",
                    german: "o Jener, Der für das Sehvermögen nicht erreichbar ist, o Jener, Dem keine Spur verborgen bleibt,",
                    slideNumber: "88"
                },
                {
                    arabic: "يا رازِقَ الْبَشَرِ يا مُقَدِّرَ كُلِّ قَدَرٍ",
                    german: "o Jener, Der die Menschen versorgt, o Jener, Der jedes Maß bemisst.",
                    slideNumber: "88"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا حافِظُ يا بارِئُ يا ذارِئُ يا باذِخُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Bewahrer, o Lebenschenkender, o Urheber, o Großzügiger",
                    slideNumber: "89"
                },
                {
                    arabic: "يا فارِجُ يا فاتِحُ يا كاشِفُ يا ضامِنُ يا امِرُ يا ناهي",
                    german: "o Erlöser, o Eröffnender, o Enthüllender, o Bürge, o Befehlender, o Verwehrender.",
                    slideNumber: "89"
                },
                {
                    arabic: "يا مَنْ لا يَعْلَمُ الْغَيْبَ إلاّ هُوَ يا مَنْ لا يَصْرِفُ السُّوءَ إلاّ هُوَ يا مَنْ لا يَخْلُقُ الْخَلْقَ إلاّ هُوَ",
                    german: "o Jener, außer Dem niemand das Verborgene weiß, o Jener, außer Dem niemand das Schlechte abwendet, o Jener, außer Dem niemand die Schöpfung erschafft,",
                    slideNumber: "90"
                },
                {
                    arabic: "يا مَنْ لا يَغْفِرُ الذَّنْبَ إلاّ هُوَ يا مَنْ لا يُتِمُّ النِّعْمَةَ إلاّ هُوَ يا مَنْ لا يُقَلِّبُ الْقُلُوبَ إلاّ هُوَ",
                    german: "o Jener, außer Dem niemand die Sünden verzeiht, o Jener, außer Dem niemand die Wohltaten vollendet, o Jener, außer Dem niemand die Herzen prüft,",
                    slideNumber: "90"
                },
                {
                    arabic: "يا مَنْ لا يُدَبِّرُ الاْمْرَ إلاّ هُوَ يا مَنْ لا يُنَزِّلُ الْغَيْثَ إلاّ هُوَ",
                    german: "o Jener, außer dem niemand die Dinge steuert, o Jener, außer Dem niemand den Regen herabsendet,",
                    slideNumber: "90"
                },
                {
                    arabic: "يا مَنْ لا يَبْسُطُ الرِّزْقَ إلاّ هُوَ يا مَنْ لا يُحْيِي الْمَوْتى إلاّ هُوَ",
                    german: "o Jener, außer Dem niemand die Versorgung verteilt, o Jener, außer Dem niemand die Toten wieder zum Leben erweckt.",
                    slideNumber: "90"
                },
                {
                    arabic: "يا مُعينَ الْضُعَفاءِ يا صاحِبَ الْغُرَباءِ يا ناصِرَ الاْوْلِياءِ",
                    german: "o Unterstützer der Schwachen, o Gefährte der Fremden, o Beistand der Gefolge,",
                    slideNumber: "91"
                },
                {
                    arabic: "يا قاهِرَ الاْعْداءِ يا رافِعَ السَّماءِ يا اَنيسَ الاْصْفِياءِ",
                    german: "o Du Bezwinger der Feinde, o Aufrichter der Himmel, o Gefährte der Auserwählten,",
                    slideNumber: "91"
                },
                {
                    arabic: "يا حَبيبَ الاْتْقِياءِ يا كَنْزَ الْفُقَراءِ يا اِلـهَ الاْغْنِياءِ يا اَكْرَمَ الْكُرَماءِ",
                    german: "o Geliebter der Frommen, o Schatz der Armen, o Gott der Reichen, o Großzügigster der Großzügigen.",
                    slideNumber: "91"
                },
                {
                    arabic: "يا كافِياً مِنْ كُلِّ شَيْءٍ يا قائِماً عَلى كُلِّ شَيْءٍ يا مَنْ لا يُشْبِهُهُ شَيْءٌ",
                    german: "o Du Genügender aller Dinge, o Du Bewahrer aller Dinge, o Jener, dem nichts ähnelt,",
                    slideNumber: "92"
                },
                {
                    arabic: "يا مَنْ لا يَزيدُ في مُلْكِهِ شَيْءٌ يا مَنْ لا يَخْفى عَلَيْهِ شَيْءٌ يا مَنْ لا يَنْقُصُ مِنْ خَزائِنِهِ شَيْءٌ",
                    german: "o Jener, Dessen Königreich nichts vermehrt, o Jener, Dem nichts verborgen bleibt, o Jener, von Dessen Schätze nichts vermindern kann,",
                    slideNumber: "92"
                },
                {
                    arabic: "يا مَنْ لَيْسَ كَمِثْلِهِ شَيْءٌ يا مَنْ لا يَعْزُبُ عَنْ عِلْمِهِ شَيءٌ",
                    german: "o Jener, Dem nichts gleicht, o Jener, Dessen Wissen nichts entgeht,",
                    slideNumber: "92"
                },
                {
                    arabic: "يا مَنْ هُوَ خَبيرٌ بِكُلِّ شَيْءٍ يا مَنْ وَسِعَتْ رَحْمَتُهُ كُلَّ شَيْءٍ",
                    german: "o Jener, Der über alles erfahren ist, o Jener, Dessen Gnade alles umschlossen hat.",
                    slideNumber: "92"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْئَلُكَ بِاسْمِكَ يا مُكْرِمُ يا مُطْعِمُ يا مُنْعِمُ يا مُعْطي",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Großzügiger, o Speisender, o Wohltätiger, o Gebender,",
                    slideNumber: "93"
                },
                {
                    arabic: "يا مُغْني يا مُقْني يا مُفْني يا مُحْيي يا مُرْضي يا مُنْجي",
                    german: "o Bereicherer, o Besitzverleiher, o Vernichter, o Lebensschenker, o Zufriedenstellender, o Retter.",
                    slideNumber: "93"
                },
                {
                    arabic: "يا اَوَّلَ كُلِّ شَيْءٍ وَآخِرَهُ يا اِلـهَ كُلِّ شَيْءٍ وَمَليكَهُ يا رَبَّ كُلِّ شَيْءٍ وَصانِعَهُ",
                    german: "o Anfang aller Dinge und deren Ende, o Gott aller Dinge und deren Herrscher, o Herr aller Dinge und deren Gestalter,",
                    slideNumber: "94"
                },
                {
                    arabic: "يا بارئَ كُلِّ شَيْءٍ وَخالِقَهُ يا قابِضَ كُلِّ شَيْءٍ وَباسِطَهُ يا مُبْدِئَ كُلِّ شَيْءٍ وَمُعيدَهُ",
                    german: "o Urheber aller Dinge und deren Schöpfer, o Begrenzer aller Dinge und deren Ausbreiter, o Ursprunggeber aller Dinge und deren Wiederbringer,",
                    slideNumber: "94"
                },
                {
                    arabic: "يا مُنْشِئَ كُلِّ شَيْءٍ وَمُقَدِّرَهُ يا مُكَوِّنَ كُلِّ شَيْءٍ وَمُحَوِّلَهُ",
                    german: "o Erschaffer aller Dinge und deren Bemesser, o Former aller Dinge und deren Umwandler,",
                    slideNumber: "94"
                },
                {
                    arabic: "يا مُحْيِيَ كُلِّ شَيْءٍ وَمُميتَهُ يا خالِقَ كُلِّ شَيْءٍ وَوارِثَهُ",
                    german: "o Lebensspender aller Dinge und deren Lebensnehmer, o Schöpfer aller Dinge und deren Erbe.",
                    slideNumber: "94"
                },
                {
                    arabic: "يا خَيْرَ ذاكِرٍ وَمَذْكُورٍ يا خَيْرَ شاكِرٍ وَمَشْكُورٍ يا خَيْرَ حامِدٍ وَمَحْمُودٍ",
                    german: "o wohltätigster Erwähnender und Erwähnter, o wohltätigster Dankender und Bedankter, o wohltätigster Lobender und Gelobter,",
                    slideNumber: "95"
                },
                {
                    arabic: "يا خَيْرَ شاهِدٍ وَمَشْهُودٍ يا خَيْرَ داعٍ وَمَدْعُوٍّ يا خَيْرَ مُجيبٍ وَمُجابٍ",
                    german: "o wohltätigster Zeuge und Bezeugter, o wohltätigster Einladender und Geladener, o wohltätigster Erfüllender und Dem entsprochen wird,",
                    slideNumber: "95"
                },
                {
                    arabic: "يا خَيْرَ مُؤنِسٍ وَاَنيسٍ يا خَيْرَ صاحِبٍ وَجَليسٍ",
                    german: "o wohltätigster Gefährtenleitender und Gefährte, o wohltätigster Begleiter und Gesellschaft Leistender,",
                    slideNumber: "95"
                },
                {
                    arabic: "يا خَيْرَ مَقْصُودٍ وَمَطْلُوبٍ يا خَيْرَ حَبيبٍ وَمَحْبُوبٍ",
                    german: "o wohltätigstes Ziel und Erwünschter, o wohltätigster Liebender und Geliebter.",
                    slideNumber: "95"
                },
                {
                    arabic: "يا مَنْ هُوَ لِمَنْ دَعاهُ مُجيبٌ يا مَنْ هُوَ لِمَنْ اَطاعَهُ حَبيبٌ",
                    german: "o Jener, Der jenen, die Ihn rufen, antwortet, o Jener, Der von jenen, die Ihm gehorchen, geliebt wird,",
                    slideNumber: "96"
                },
                {
                    arabic: "يا مَنْ هُوَ اِلى مَنْ اَحَبَّهُ قَريبٌ يا مَنْ هُوَ بِمَنِ اسْتَحْفَظَهُ رَقيبٌ",
                    german: "o Jener, Der jenen, die Ihn lieben, nahe ist, o Jener, Der jene, die Ihn um Behütung bitten, bewacht,",
                    slideNumber: "96"
                },
                {
                    arabic: "يا مَنْ هُوَ بِمَنْ رَجاهُ كَريمٌ يا مَنْ هُوَ بِمَنْ عَصاهُ حَليمٌ",
                    german: "o Jener, Der gegenüber jenen, die auf Ihn hoffen, großzügig ist, o Jener, Der nachsichtig mit jenen ist, die ihm gegenüber ungehorsam sind,",
                    slideNumber: "96"
                },
                {
                    arabic: "يا مَنْ هُوَ في عَظَمَتِهِ رَحيمٌ يا مَنْ هُوَ في حِكْمَتِهِ عَظيمٌ",
                    german: "o Jener, Der in Seiner Größe barmherzig ist, o Jener, Der in Seiner Weisheit groß ist,",
                    slideNumber: "96"
                },
                {
                    arabic: "يا مَنْ هُوَ في اِحْسانِهِ قَديمٌ يا مَنْ هُوَ بِمَنْ اَرادَهُ عَليمٌ",
                    german: "o Jener, Der in Seiner Güte ohne Anfang ist, o Jener, Der um jene weiß, die Ihn erstreben.",
                    slideNumber: "96"
                },
                {
                    arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُسَبِّبُ يا مُرَغِّبُ يا مُقَلِّبُ",
                    german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Verursacher, o Erweckender von Begehren, o Prüfer,",
                    slideNumber: "97"
                },
                {
                    arabic: "يا مُعَقِّبُ يا مُرَتِّبُ يا مُخَوِّفُ يا مُحَذِّرُ يا مُذَكِّرُ يا مُسَخِّرُ يا مُغَيِّرُ",
                    german: "o Verfolger, o Ordner, o Angsteinflößender, o Warnender, o Erinnernder, o Unterwerfer, o Verändernder.",
                    slideNumber: "97"
                },
                {
                    arabic: "يا مَنْ عِلْمُهُ سابِقٌ يا مَنْ وَعْدُهُ صادِقٌ يا مَنْ لُطْفُهُ ظاهِرٌ",
                    german: "o Jener, Dessen Wissen schon früher existiert, o Jener, Dessen Versprechen aufrichtig ist, o Jener, Dessen Nachsicht offensichtlich ist,",
                    slideNumber: "98"
                },
                {
                    arabic: "يا مَنْ اَمْرُهُ غالِبٌ يا مَنْ كِتابُهُ مُحْكَمٌ يا مَنْ قَضاؤُهُ كأئِنٌ",
                    german: "o Jener, Dessen Befehl siegreich ist, o Jener, Dessen Buch unmissverständlich ist, o Jener, Dessen Richtsspruch existiert",
                    slideNumber: "98"
                },
                {
                    arabic: "يا مَنْ قُرآنُهُ مَجيدٌ يا مَنْ مُلْكُهُ قَديمٌ",
                    german: "o Jener, Dessen Qur´an ruhmreich ist, o Jener, Dessen Herrschaft ohne Anfang ist,",
                    slideNumber: "98"
                },
                {
                    arabic: "يا مَنْ فَضْلُهُ عَميمٌ يا مَنْ عَرْشُهُ عَظيمٌ",
                    german: "o Jener, Dessen Huld allgemein ist, o Jener, Dessen Thron herrlich ist.",
                    slideNumber: "98"
                },
                {
                    arabic: "يا مَنْ لا يَشْغَلُهُ سَمْعٌ عَنْ سَمْعٍ يا مَنْ لا يَمْنَعُهُ فِعْلٌ عَنْ فِعْلٍ",
                    german: "o Jener, Den das Hören nicht vom Hören ablenkt, o Jener, Dem keine Tat am Handeln hindert,",
                    slideNumber: "99"
                },
                {
                    arabic: "يا مَنْ لا يُلْهيهِ قَوْلٌ عَنْ قَوْلٍ يا مَنْ لا يُغَلِّطُهُ سُؤالٌ عَنْ سُؤالٍ",
                    german: "o Jener, Den das Aussprechen nicht vom Aussprechen abhält, o Jener, Der durch Fragen nicht vom Fragen abgebracht wird",
                    slideNumber: "99"
                },
                {
                    arabic: "يا مَنْ لا يَحْجُبُهُ شَيْءٌ عَنْ شَيْءٍ يا مَنْ لا يُبْرِمُهُ اِلْحاحُ الْمُلِحّينَ",
                    german: "o Jener, Der nicht von etwas abgeschirmt wird durch etwas anderes, o Jener, Der durch das Drängen der Beharrlichen nicht überdrüssig wird,",
                    slideNumber: "99"
                },
                {
                    arabic: "يا مَنْ هُوَ غايَةُ مُرادِ الْمُريدينَ",
                    german: "o Jener, Der der Beweggrund der Begehrenden ist",
                    slideNumber: "99"
                },
                {
                    arabic: "يا مَنْ هُوَ مُنْتَهى هِمَمِ الْعارِفينَ يا مَنْ هُوَ مُنْتَهى طَلَبِ الطّالِبينَ",
                    german: "o Jener, Der das Endziel des Willens der Wissenden ist, o Jener, Der das Endziel des Strebens der Strebenden ist,",
                    slideNumber: "99"
                },
                {
                    arabic: "يا مَنْ لا يَخْفى عَلَيْهِ ذَرَّةٌ فِي الْعالَمينَ",
                    german: "o Jener, Dem kein Atom in den Welten verborgen ist.",
                    slideNumber: "99"
                },
                {
                    arabic: "يا حَليماً لا يَعْجَلُ يا جَواداً لا يَبْخَلُ يا صادِقاً لا يُخْلِفُ",
                    german: "o Nachsichtiger, Der es nicht eilig hat, o Großzügiger, Der nicht geizig ist, o Wahrhaftiger, Der sein Versprechen nicht bricht,",
                    slideNumber: "100"
                },
                {
                    arabic: "يا وَهّاباً لا يَمَلُّ يا قاهِراً لا يُغْلَبُ يا عَظيماً لا يُوصَفُ",
                    german: "o Schenker, Der nicht verdrossen wird, o Bezwinger, Der nicht besiegt wird, o Gewaltiger, Der nicht beschreibbar ist,",
                    slideNumber: "100"
                },
                {
                    arabic: "يا عَدْلاً لا يَحيفُ يا غَنِيّاً لا يَفْتَقِرُ يا كَبيراً لا يَصْغُرُ يا حافِظاً لا يَغْفَلُ.",
                    german: "o Gerechter, Der nicht ungerecht wird, o Reicher, Der nicht verarmt, o Großer, Der nicht klein wird, o Behüter, Der nicht vernachlässigt.",
                    slideNumber: "100"
                }
            ],
        }
        */

        const duaChapter = {
            name: 'دعاء الجوشن الكبير',
            verses: [
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَللهُ يا رَحْمنُ يا رَحيمُ يا كَريمُ يا مُقيمُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Allah, o Gnädiger, o Erbarmer, o Großzügiger,",
                        slideNumber: "1"
                    },
                    {
                        arabic: "يا عَظيمُ يا قَديمُ يا عَليمُ يا حَليمُ يا حَكيمُ",
                        german: "o Aufrechterhalter, o Herrlicher, o Anfangsloser, o Wissender, o Sanftmütiger, o Weiser.",
                        slideNumber: "1"
                    }
                ],
                [
                    {
                        arabic: "يا سَيِّدَ السّاداتِ يا مُجيبَ الدَّعَواتِ يا رافِعَ الدَّرَجاتِ",
                        german: "o Fürst der Fürsten, o Erhörender der Gebete, o Ehrhöher des Ranges,",
                        slideNumber: "2"
                    },
                    {
                        arabic: "يا وَلِيَّ الْحَسَناتِ يا غافِرَ الْخَطيئاتِ يا مُعْطِيَ الْمَسْأَلاتِ",
                        german: "o Statthalter der guten Dinge, o Vergebender der Fehler, o Erfüllender der Wünsche,",
                        slideNumber: "2"
                    },
                    {
                        arabic: "يا قابِلَ التَّوْباتِ يا سامِعَ الأصْواتِ يا عالِمَ الْخَفِيّاتِ يا دافِعَ الْبَلِيَّاتِ",
                        german: "o Annehmer der Reue, o Hörender der Stimmen, o Wissender des Verborgenen, o Fernhalter des Unheils",
                        slideNumber: "2"
                    }
                ],
                [
                    {
                        arabic: "يا خَيْرَ الْغافِرينَ يا خَيْرَ الْفاتِحينَ يا خَيْرَ النّاصِرينَ يا خَيْرَ الْحاكِمينَ يا خَيْرَ الرّازِقينَ",
                        german: "o Segenreichster der Vergeber, o Segenreichster der Eroberer, o Segenreichster der Helfer, o Segenreichster der Regierenden, o Segenreichster der Ernährer,",
                        slideNumber: "3"
                    },
                    {
                        arabic: "يا خَيْرَ الْوارِثينَ يا خَيْرَ الْحامِدينَ يا خَيْرَ الذّاكِرينَ يا خَيْرَ الْمُنْزِلينَ يا خَيْرَ الْمحْسِنينَ",
                        german: "o Segenreichster der Erben, o Segenreichster der Lobenden, o Segenreichster der Preisenden, o Segenreichster der Herabsendenden, o Segenreichster der Wohltäter.",
                        slideNumber: "3"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ لَهُ الْعِزَّةُ وَالْجَمالُ يا مَنْ لَهُ الْقُدْرَةُ وَالْكَمالُ",
                        german: "o Jener, Der die Erhabenheit und die Schönheit ist, o Jener, Der die Allmacht und die Vollkommenheit ist,",
                        slideNumber: "4"
                    },
                    {
                        arabic: "يا مَنْ لَهُ الْمُلْكُ وَالْجَلالُ يا مَنْ هُوَ الْكَبيرُ الْمُتَعالُ",
                        german: "o Jener, Der die Herrschaft und die Pracht ist, o Jener, Der groß und erhaben ist,",
                        slideNumber: "4"
                    },
                    {
                        arabic: "يا مُنْشِىءَ الْسَّحابِ الثِّقالِ يا مَنْ هُوَ شَديدُ الْمحالِ",
                        german: "o Jener, Der die schweren Wolken erschafft, o Jener, Der unermesslich stark ist,",
                        slideNumber: "4"
                    },
                    {
                        arabic: "يا مَنْ هُوَ سَريعُ الْحِسابِ يا مَنْ هُوَ شَديدُ الْعِقابِ",
                        german: "o Jener, Der schnell richtet, o Jener, Der streng bestraft,",
                        slideNumber: "4"
                    },
                    {
                        arabic: "يا مَنْ عِنْدَهُ حُسْنُ الثَّوابِ يا مَنْ عِنْدَهُ اُمُّ الْكِتابِ",
                        german: "o Jener, bei Dem sich die schönste Belohnung befindet, o Jener, bei Dem sich die Mutter des Buches befindet.",
                        slideNumber: "4"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا حَنّانُ يا مَنّانُ يا دَيّانُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Gnädiger, o Großzügiger, o gerecht Richtender",
                        slideNumber: "5"
                    },
                    {
                        arabic: "يا بُرْهانُ يا سُلْطانُ يا رِضْوانُ يا غُفْرانُ يا سُبْحانُ يا مُسْتَعانُ يا ذَا الْمَنِّ وَالْبَيانِ",
                        german: "o Beweis, o Herrscher, o Zufriedensteller, o Vergebender, o Gepriesener, o um Hilfe Gebetener, o Eigner der Gunst und der Beredsamkeit.",
                        slideNumber: "5"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ تَواضَعَ كُلُّ شَيْءٍ لِعَظَمَتِهِ يا مَنِ اسْتَسْلَمَ كُلُّ شَيْءٍ لِقُدْرَتِهِ",
                        german: "o Jener, dessen Größe sich alles unterwirft, o Jener, dessen Allmacht sich alles unterordnet",
                        slideNumber: "6"
                    },
                    {
                        arabic: "يا مَنْ ذَلَّ كُلُّ شَيْءٍ لِعِزَّتِهِ يا مَنْ خَضَعَ كُلُّ شَيْءٍ لِهَيْبَتِهِ",
                        german: "o Jener, vor Dessen Ehre sich alles erniedrigt, o Jener, Dessen Würde alles Folge leistet",
                        slideNumber: "6"
                    },
                    {
                        arabic: "يا مَنِ انْقادَ كُلُّ شَيْءٍ مِنْ خَشْيَتِهِ يا مَنْ تَشَقَّقَتِ الْجِبالُ مِنْ مَخافَتِهِ",
                        german: "o Jener, Dessen Herrschaft sich alles fügt, o Jener, aus Furcht vor dem sich alles beugt",
                        slideNumber: "6"
                    },
                    {
                        arabic: "يا مَنْ قامَتِ السَّماواتُ بِاَمْرِهِ يا مَنِ اسْتَقَرَّتِ الاْرَضُونَ بِاِذْنِهِ",
                        german: "o Jener, aus Furcht vor dem sich die Berge spalten, o Jener Dessen Befehl die Himmel aufrecht erhält",
                        slideNumber: "6"
                    },
                    {
                        arabic: "يا مَنْ يُسَبِّحُ الرَّعْدُ بِحَمْدِهِ يا مَنْ لا يَعْتَدي عَلى اَهْلِ مَمْلَكَتِهِ",
                        german: "o Jener, mit Dessen Erlaubnis die Erde von Bestand ist, o Jener, der Du nicht ungerecht gegen die Bewohner des Königreichs handelst",
                        slideNumber: "6"
                    }
                ],
                [
                    {
                        arabic: "يا غافِرَ الْخَطايا يا كاشِفَ الْبَلايا يا مُنْتَهَى الرَّجايا يا مُجْزِلَ الْعَطايا",
                        german: "o Verzeihender der Fehler, o Beseitigender des Unheils, o letzte Instanz der Hoffnungen, o reichlich Schenkender der Gaben,",
                        slideNumber: "7"
                    },
                    {
                        arabic: "يا واهِبَ الْهَدايا يا رازِقَ الْبَرايا",
                        german: "o Gewährer der Geschenke, o Ernährer der Geschöpfe,",
                        slideNumber: "7"
                    },
                    {
                        arabic: "يا قاضِيَ الْمَنايا يا سامِعَ الشَّكايا يا باعِثَ الْبَرايا يا مُطْلِقَ الأُسارى",
                        german: "o Richter über die Geschicke, o Erhörender der Klagen, o die Geschöpfe zum Leben Erweckender, o Befreier der Gefangenen.",
                        slideNumber: "7"
                    }
                ],
                [
                    {
                        arabic: "يا ذَا الْحَمْدِ وَالثَّناءِ يا ذَا الْفَخْرِ وَاْلبَهاءِ يا ذَا الْمجْدِ وَالسَّناءِ يا ذَا الْعَهْدِ وَالْوَفاءِ",
                        german: "o Eigentümer des Lobes und des Preises, o Eigentümer des Ruhmes und des Glanzes, o Eigentümer der Ehre und der Erhabenheit, o Eigentümer des Vertrags und seiner Einhaltung",
                        slideNumber: "8"
                    },
                    {
                        arabic: "يا ذَا الْعَفْوِ وَالرِّضاءِ يا ذَا الْمَنِّ وَالْعَطاءِ",
                        german: "o Eigentümer der Vergebung und der Zufriedenheit, o Eigentümer der Gunst und der Gewährung",
                        slideNumber: "8"
                    },
                    {
                        arabic: "يا ذَا الْفَصْلِ وَالْقَضاءِ يا ذَا الْعِزِّ وَالْبَقاءِ يا ذَا الْجُودِ وَالسَّخاءِ يا ذَا الألآءِ وَالنَّعْماءِ",
                        german: "o Eigentümer der Entscheidung und des Urteils, o Eigentümer der Macht und der Ewigkeit, o Eigentümer der Freigiebigkeit und der Gunstbeweise, o Eigentümer der Wohltaten und der Gaben.",
                        slideNumber: "8"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مانِعُ يا دافِعُ يا رافِعُ يا صانِعُ يا نافِعُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Verhinderer, o Verteidiger, o Erhörer, o Erschaffer, o Wohltäter,",
                        slideNumber: "9"
                    },
                    {
                        arabic: "يا سامِعُ يا جامِعُ يا شافِعُ يا واسِعُ يا مُوسِعُ",
                        german: "o Erhörender, o Vereinender, o Fürsprecher, o Weitreichender, o reichlich Vermögender.",
                        slideNumber: "9"
                    }
                ],
                [
                    {
                        arabic: "يا صانِعَ كُلِّ مَصْنُوعٍ يا خالِقَ كُلِّ مَخْلُوقٍ يا رازِقَ كُلِّ مَرْزُوقٍ يا مالِكَ كُلِّ مَمْلُوكٍ",
                        german: "o Erschaffer alles Erschaffenen, o Schöpfer aller Geschöpfe, o Versorger all dessen, was versorgt wird, o Herrscher aller Beherrschten,",
                        slideNumber: "10"
                    },
                    {
                        arabic: "يا كاشِفَ كُلِّ مَكْرُوبٍ يا فارِجَ كُلِّ مَهْمُومٍ",
                        german: "o Erlöser aller Leidenden, o Befreier aller Bekümmerten",
                        slideNumber: "10"
                    },
                    {
                        arabic: "يا راحِمَ كُلِّ مَرْحُومٍ يا ناصِرَ كُلِّ مَخْذُولٍ يا ساتِرَ كُلِّ مَعْيُوبٍ يا مَلْجَأَ كُلِّ مَطْرُودٍ",
                        german: "o Erbarmer aller Erbarmten, o Beistand aller in Stich gelassenen, o Verhüller aller Fehlerbehafteten, o Zuflucht aller Ausgestoßenen.",
                        slideNumber: "10"
                    }
                ],
                [
                    {
                        arabic: "يا عُدَّتي عِنْدَ شِدَّتي يا رَجائي عِنْدَ مُصيبَتي يا مُونِسي عِنْدَ وَحْشَتي يا صاحِبي عِنْدَ غُرْبَتي",
                        german: "o mein Helfer in meiner Not, o meine Hoffnung in meiner Heimsuchung, o mein Vertrauter in meiner Einsamkeit, o mein Gefährte in meiner Fremde,",
                        slideNumber: "11"
                    },
                    {
                        arabic: "يا وَلِيّي عِنْدَ نِعْمَتي يا غِياثي عِنْدَ كُرْبَتي",
                        german: "o mein Wohltäter in meinen Gaben, o mein Helfer in meinen Sorgen,",
                        slideNumber: "11"
                    },
                    {
                        arabic: "يا دَليلي عِنْدَ حَيْرَتي يا غَنائي عِنْدَ افْتِقاري يا مَلجَأي عِنْدَ اضْطِراري يا مُعيني عِنْدَ مَفْزَعي",
                        german: "o mein Wegweiser in meiner Verwirrung, o mein Reichtum in meiner Mittellosigkeit, o meine Zuflucht in meiner Notlage, o mein Beistand in meinem Schrecken.",
                        slideNumber: "11"
                    }
                ],
                [
                    {
                        arabic: "يا عَلاّمَ الْغُيُوبِ يا غَفّارَ الذُّنُوبِ يا سَتّارَ الْعُيُوبِ يا كاشِفَ الْكُرُوبِ يا مُقَلِّبَ الْقُلُوبِ يا طَبيبَ الْقُلُوبِ",
                        german: "o Wissender der verborgenen Dinge, o Vergebender der Sünden, o Verhüller der Fehler, o Beseitigender des Unheils, o Verfügender über die Herzen, o Heiler der Herzen, o Erleuchtender der Herzen,",
                        slideNumber: "12"
                    },
                    {
                        arabic: "يا مُنَوِّرَ الْقُلُوبِ يا اَنيسَ الْقُلُوبِ يا مُفَرِّجَ الْهُمُومِ يا مُنَفِّسَ الْغُمُومِ",
                        german: "o Erleuchtender der Herzen, o Geselliger der Herzen, o Erlöser von den Sorgen, o Befreier von den Kümmernissen.",
                        slideNumber: "12"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاْسمِكَ يا جَليلُ يا جَميلُ يا وَكيلُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Majestätischer, o Schöner, o Sachwalter,",
                        slideNumber: "13"
                    },
                    {
                        arabic: "يا كَفيلُ يا دَليلُ يا قَبيلُ يا مُديلُ يا مُنيلُ يا مُقيلُ يا مُحيلُ",
                        german: "o Bürge, o Wegweiser, o Garant, o Nahebringender, o Ermöglichender des Erlangens, o Hilfeeilender, o Kraftspender.",
                        slideNumber: "13"
                    }
                ],
                [
                    {
                        arabic: "يا دَليلَ الْمُتَحَيِّرينَ يا غِياثَ الْمُسْتَغيثينَ يا صَريخَ الْمُسْتَصْرِخينَ يا جارَ الْمُسْتَجيرينَ",
                        german: "o Wegweiser der Verwirrten, o Rettung der Rettungssuchenden, o Hilfreicher der um Hilfe Rufenden, o Schutz der Schutzsuchenden,",
                        slideNumber: "14"
                    },
                    {
                        arabic: "يا اَمانَ الْخائِفينَ يا عَوْنَ الْمُؤْمِنينَ",
                        german: "o Sicherheit der Beängstigten, o Helfer der Gläubigen,",
                        slideNumber: "14"
                    },
                    {
                        arabic: "يا راحِمَ الْمَساكينَ يا مَلْجَأَ الْعاصينَ يا غافِرَ الْمُذْنِبينَ يا مُجيبَ دَعْوَةِ الْمُضْطَرّينَ",
                        german: "o Erbarmer der Elenden, o Zuflucht der Ungehorsamen, o Vergebender der Sündigen, o Erhörender des Rufes der Bedrängten.",
                        slideNumber: "14"
                    }
                ],
                [
                    {
                        arabic: "يا ذَا الْجُودِ وَالاْحْسانِ يا ذَا الْفَضْلِ وَالاْمْتِنانِ يا ذَا الاْمْنِ وَالاْمانِ يا ذَا الْقُدْسِ وَالسُّبْحانِ",
                        german: "o Eigner der Freigebigkeit und der Wohltätigkeit, o Eigner der Huld und der Güte, o Eigner des Schutzes und der Sicherheit, o Eigner der Heiligkeit und der Verherrlichung,",
                        slideNumber: "15"
                    },
                    {
                        arabic: "يا ذَا الْحِكْمَةِ وَالْبَيانِ يا ذَا الرَّحْمَةِ وَالرِّضْوانِ",
                        german: "o Eigner der Weisheit und der Beredsamkeit, o Eigner der Gnade und der Zufriedenheit,",
                        slideNumber: "15"
                    },
                    {
                        arabic: "يا ذَا الْحُجَّةِ وَالْبُرْهانِ يا ذَا الْعَظَمَةِ وَالسُّلْطانِ يا ذَا الرَّأْفَةِ وَالْمُسْتَعانِ يا ذَا العَفْوِ وَالْغُفْرانِ",
                        german: "o Eigner des Arguments und des Beweises, o Eigner der Größe und der unumschränkten Macht, o Eigner der Gnade und der Unterstützung, o Eigner der Verzeihung und der Vergebung.",
                        slideNumber: "15"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ هُوَ رَبُّ كُلِّ شَيْءٍ يا مَنْ هُوَ اِلـهُ كُلِّ شَيءٍ يا مَنْ هُوَ خالِقُ كُلِّ شَيْءٍ",
                        german: "o Jener, Der Herr aller Dinge ist, o Jener, Der Gott aller Dinge ist, o Jener, Der Schöpfer aller Dinge ist,",
                        slideNumber: "16"
                    },
                    {
                        arabic: "يا مَنْ هُوَ صانِعُ كُلِّ شَيْءٍ يا مَنْ هُوَ قَبْلَ كُلِّ شَيْءٍ يا مَنْ هُوَ بَعْدَ كُلِّ شَيْءٍ",
                        german: "o Jener, Der Erschaffer aller Dinge ist, o Jener, Der vor Allem war, o Jener, Der nach Allem sein wird,",
                        slideNumber: "16"
                    },
                    {
                        arabic: "يا مَنْ هُوَ فَوْقَ كُلِّ شَيْءٍ يا مَنْ هُوَ عالِمٌ بِكُلِّ شَيْءٍ",
                        german: "o Jener, Der über Allem steht, o Jener, Der alles weiß,",
                        slideNumber: "16"
                    },
                    {
                        arabic: "يا مَنْ هُوَ قادِرٌ عَلى كُلِّ شَيْءٍ يا مَنْ هُوَ يَبْقى وَيَفْنى كُلُّ شَيْءٍ",
                        german: "o Jener, Der Macht über alle Dinge besitzt, o Jener, Der beständig ist, während alles (andere) vergänglich ist.",
                        slideNumber: "16"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُؤْمِنُ يا مُهَيْمِنُ يا مُكَوِّنُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Überzeugender, o Beherrscher, o Urheber,",
                        slideNumber: "17"
                    },
                    {
                        arabic: "يا مُلَقِّنُ يا مُبَيِّنُ يا مُهَوِّنُ يا مُمَكِّنُ يا مُزَيِّنُ يا مُعْلِنُ يا مُقَسِّمُ",
                        german: "o Unterweiser, o Aufzeigender, o Erleichterer, o Ermöglicher, o Verschönerer, o Verkünder, o Verteilender.",
                        slideNumber: "17"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ هُوَ في مُلْكِهِ مُقيمٌ يا مَنْ هُوَ في سُلْطانِهِ قديم يا مَنْ هُو في جَلالِهِ عَظيمٌ",
                        german: "o Jener, Der in seinem Königreich ewig ist, o Jener, Der in seiner unumschränkten Herrschaft immerwährend ist, o Jener, Der in seiner Pracht groß ist,",
                        slideNumber: "18"
                    },
                    {
                        arabic: "يا مَنْ هُوَ عَلى عِبادِهِ رَحيمٌ يا مَنْ هُوَ بِكُلِّ شَيْءٍ عَليمٌ يا مَنْ هُوَ بِمَنْ عَصاهُ حَليمٌ",
                        german: "o Jener, Der gegenüber seinen Dienern begnadend ist, o Jener, Der Wissend über alles ist, o Jener, Der nachsichtig gegenüber jenen ist, die Ihm gegenüber ungehorsam waren,",
                        slideNumber: "18"
                    },
                    {
                        arabic: "يا مَنْ هُوَ بِمَنْ رَجاهُ كَريمٌ يا مَنْ هُوَ في صُنْعِهِ حَكيمٌ يا مَنْ هُوَ في حِكْمَتِهِ لَطيفٌ يا مَنْ هُوَ في لُطْفِهِ قَديمٌ",
                        german: "o Jener, Der gegenüber jenen, die auf Ihn hoffen, großzügig ist, o Jener, Der in Seinem Handeln weise ist, o Jener, Der in Seiner Weisheit nachsichtig ist, o Jener, Dessen Nachsicht immerwährend ist.",
                        slideNumber: "18"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ لا يُرْجى إلاّ فَضْلُهُ يا مَنْ لا يُسْأَلُ إلاّ عَفْوُهُ يا مَنْ لا يُنْظَرُ إلاّ بِرُّهُ",
                        german: "o Jener, außer Dessen Huld nichts erhofft wird, o Jener, außer Dessen Vergebung nichts erbeten wird, o Jener, außer Dessen Güte nichts erwartet wird,",
                        slideNumber: "19"
                    },
                    {
                        arabic: "يا مَنْ لا يُخافُ إلاّ عَدْلُهُ يا مَنْ لا يَدُومُ إلاّ مُلْكُهُ يا مَنْ لا سُلْطانَ إلاّ سُلْطانُهُ",
                        german: "o Jener, außer Dessen Gerechtigkeit nichts gefürchtet wird, o Jener, außer Dessen Reich nichts überdauert, o Jener, außer Dessen Herrschaftsgewalt es keine Herrschaftsgewalt gibt,",
                        slideNumber: "19"
                    },
                    {
                        arabic: "يا مَنْ وَسِعَتْ كُلَّ شَيْءٍ رَحْمَتُهُ يا مَنْ سَبَقَتْ رَحْمَتُهُ غَضَبَهُ",
                        german: "o Jener, Dessen Gnade alles umfasst, o Jener, Dessen Gnade Seinen Zorn übertrifft,",
                        slideNumber: "19"
                    },
                    {
                        arabic: "يا مَنْ اَحاطَ بِكُلِّ شَيْءٍ عِلْمُهُ يا مَنْ لَيْسَ اَحَدٌ مِثْلَهُ",
                        german: "o Jener, Dessen Wissen alles umfasst, o Jener, dem keiner ähnelt.",
                        slideNumber: "19"
                    }
                ],
                [
                    {
                        arabic: "يا فارِجَ الْهَمِّ يا كاشِفَ الْغَمِّ يا غافِرَ الذَّنْبِ يا قابِلَ التَّوْبِ يا خالِقَ الْخَلْقِ",
                        german: "o Befreier von den Sorgen, o Beseitigender des Kummers, o Vergebender der Sünden, o Annehmender der Reue, o Schöpfer der Schöpfung,",
                        slideNumber: "20"
                    },
                    {
                        arabic: "يا صادِقَ الْوَعْدِ يا مُوفِيَ الْعَهْدِ يا عالِمَ السِّرِّ يا فالِقَ الْحَبِّ يا رازِقَ الاْنامِ",
                        german: "o Jener, Der Seinem Versprechen treu ist, o Einhalter des Vertrages, o Wissender der Geheimnisse, o Spalter der Samenkörner, o Ernährer der Menschen.",
                        slideNumber: "20"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا عَلِيُّ يا وَفِيُّ يا غَنِيُّ يا مَلِيُّ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Höchster, o Treuer, o Sich Selbst Genügender, o Zeitloser,",
                        slideNumber: "21"
                    },
                    {
                        arabic: "يا حَفِيُّ يا رَضِيُّ يا زَكِيُّ يا بَدِيُّ يا قَوِيُّ يا وَلِيُّ",
                        german: "o Ehrender, o Zufriedener, o Reiner, o Offenbarer, o Starker, o Vormund.",
                        slideNumber: "21"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ اَظْهَرَ الْجَميلَ يا مَنْ سَتَرَ الْقَبيحَ يا مَنْ لَمْ يُؤاخِذْ بِالْجَريرَةِ",
                        german: "o Jener, Der das Schöne enthüllt, o Jener, Der das Hässliche verhüllt, o Jener, Der das Verbrechen nicht gleich bestraft,",
                        slideNumber: "22"
                    },
                    {
                        arabic: "يا مَنْ لَمْ يَهْتِكِ السِّتْرَ يا عَظيمَ الْعَفْوِ يا حَسَنَ التَّجاوُزِ يا واسِعَ الْمَغْفِرَةِ",
                        german: "o Jener, Der das Schöne enthüllt, o Jener, Der das Hässliche verhüllt, o Jener, Der das Verbrechen nicht gleich bestraft, o Jener, Der den Schutz nicht entreißt, o Jener, Dessen Vergebung groß ist, o Jener, Der gütig unbestraft lässt, o Jener, Dessen Vergebung allumfassend ist,",
                        slideNumber: "22"
                    },
                    {
                        arabic: "يا باسِطَ الْيَدَيْنِ بِالرَّحْمَةِ يا صاحِبَ كُلِّ نَجْوى يا مُنْتَهى كُلِّ شَكْوى",
                        german: "o Jener, Der mit Gnade freigiebig ist, o Gefährte aller stillen Gebete, o letzte Instanz aller Beschwerden.",
                        slideNumber: "22"
                    }
                ],
                [
                    {
                        arabic: "يا ذَا النِّعْمَةِ السّابِغَةِ يا ذَا الرَّحْمَةِ الْواسِعَةِ يا ذَا الْمِنَّةِ السّابِقَةِ يا ذَا الْحِكْمَةِ الْبالِغَةِ",
                        german: "o Eigner der im Überfluss vorhandenen Gaben, o Eigner der weitreichenden Gnade, o Eigner vergangener Gunst, o Eigner der außerordentlichen Weisheit,",
                        slideNumber: "23"
                    },
                    {
                        arabic: "يا ذَا الْقُدْرَةِ الْكامِلَةِ يا ذَا الْحُجَّةِ الْقاطِعَةِ",
                        german: "o Eigner der absoluten Macht, o Eigner des schlagenden Arguments,",
                        slideNumber: "23"
                    },
                    {
                        arabic: "يا ذَا الْكَرامَةِ الظّاهِرَةِ يا ذَا الْعِزَّةِ الدّائِمَةِ يا ذَا الْقُوَّةِ الْمَتينَةِ يا ذَا الْعَظَمَةِ الْمَنيعَةِ",
                        german: "o Eigner der offensichtlichen Ehre, o Eigner der dauerhaften Erhabenheit, o Eigner der festen Macht, o Eigner der unüberwindbaren Größe.",
                        slideNumber: "23"
                    }
                ],
                [
                    {
                        arabic: "يا بَديعَ السَّماواتِ يا جاعِلَ الظُّلُماتِ يا راحِمَ الْعَبَراتِ يا مُقيلَ الْعَثَراتِ",
                        german: "o Schöpfer der Himmel, o Errichter der Finsternisse,o Erbarmer der Tränen, o Aufhebender der Verfehlungen",
                        slideNumber: "24"
                    },
                    {
                        arabic: "يا ساتِرَ الْعَوْراتِ يا مُحْيِيَ الأمْواتِ",
                        german: "o Auslöschender der schlechten Taten, o Strenger der Bestrafenden.",
                        slideNumber: "24"
                    },
                    {
                        arabic: "يا مُنْزِلَ الآياتِ يا مُضَعِّفَ الْحَسَناتِ يا ماحِيَ السَّيِّئاتِ يا شَديدَ النَّقِماتِ",
                        german: "o Herabsendender der Zeichen, o Vervielfacher der guter Taten, o Auslöschender der schlechten Taten, o Strenger der Bestrafenden.",
                        slideNumber: "24"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُصَوِّرُ يا مُقَدِّرُ يا مُدَبِّرُ يا مُطَهِّرُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Gestalter, o Vorbestimmender, o Waltender, o Bereinigender,",
                        slideNumber: "25"
                    },
                    {
                        arabic: "يا مُنَوِّرُ يا مُيَسِّرُ يا مُبَشِّرُ يا مُنْذِرُ يا مُقَدِّمُ يا مُؤَخِّرُ",
                        german: "o Erleuchtender, o Erleichterer, o Verkünder, o Ermahner, o Vorziehender, o Aufschiebender.",
                        slideNumber: "25"
                    }
                ],
                [
                    {
                        arabic: "يا رَبَّ الْبَيْتِ الْحَرامِ يا رَبَّ الشَّهْرِ الْحَرامِ يا رَبَّ الْبَلَدِ الْحَرامِ",
                        german: "o Herr des geweihten Hauses, o Herr des geweihten Monats, o Herr der geweihten Stadt",
                        slideNumber: "26"
                    },
                    {
                        arabic: "يا رَبَّ الرُّكْنِ وَالْمَقامِ يا رَبَّ الْمَشْعَرِ الْحَرامِ يا رَبَّ الْمَسْجِدِ الْحَرامِ",
                        german: "o Herr der Stellung und des Ranges, o Herr des geweihten “Maschar“, o Herr der geweihten Moschee,",
                        slideNumber: "26"
                    },
                    {
                        arabic: "يا رَبَّ الْحِلِّ وَالْحَرامِ يا رَبَّ النُّورِ وَالظَّلامِ يا رَبَّ التَّحِيَّةِ وَالسَّلامِ يا رَبَّ الْقُدْرَةِ فِي الاْنام",
                        german: "o Herr des Erlaubten und des Verbotenen, o Herr des Lichtes und der Finsternis o Herr der Begrüßung und des Friedens o Herr der Macht über die Menschen.",
                        slideNumber: "26"
                    }
                ],
                [
                    {
                        arabic: "يا اَحْكَمَ الْحاكِمينَ يا اَعْدَلَ الْعادِلينَ يا اَصْدَقَ الصّادِقينَ",
                        german: "o Mächtigster der Regierenden, o Gerechtester der Gerechten, o Aufrichtigster der Aufrichtigen,",
                        slideNumber: "27"
                    },
                    {
                        arabic: "يا اَطْهَرَ الطّاهِرينَ يا اَحْسَنَ الْخالِقينَ يا اَسْرَعَ الْحاسِبينَ",
                        german: "o Reinster der Reinen, o Schönster der Schöpfer, o Schnellster der Abrechnenden,",
                        slideNumber: "27"
                    },
                    {
                        arabic: "يا اَسْمَعَ السّامِعينَ يا اَبْصَرَ النّاظِرينَ يا اَشْفَعَ الشّافِعينَ يا اَكْرَمَ الاْكْرَمينَ",
                        german: "Besthörender der Hörenden, o Scharfsichtiger der Schauenden, o bester Fürsprecher der Fürsprecher, o Großzügigster der Großzügigen.",
                        slideNumber: "27"
                    }
                ],
                [
                    {
                        arabic: "يا عِمادَ مَنْ لا عِمادَ لَهُ يا سَنَدَ مَنْ لا سَنَدَ لَهُ يا ذُخْرَ مَنْ لا ذُخْرَ لَهُ",
                        german: "o Stütze dessen, der keine Stütze hat, o Rückhalt dessen, der keinen Rückhalt hat, o Reichtum dessen, der keinen Reichtum hat,",
                        slideNumber: "28"
                    },
                    {
                        arabic: "يا حِرْزَ مَنْ لا حِرْزَ لَهُ يا غِياثَ مَنْ لا غِياثَ لَهُ يا فَخْرَ مَنْ لا فَخْرَ لَهُ",
                        german: "o Festung dessen, der keine Festung hat, o Retter dessen, der keinen Retter hat, o Stolz dessen, der keinen Stolz hat,",
                        slideNumber: "28"
                    },
                    {
                        arabic: "يا عِزَّ مَنْ لا عِزَّ لَهُ يا مُعينَ مَنْ لا مُعينَ لَهُ يا اَنيسَ مَنْ لا اَنيسَ لَهُ يا اَمانَ مَنْ لا اَمانَ لَهُ",
                        german: "o Ruhm dessen, der keinen Ruhm hat, o Beistand dessen, der keinen Beistand hat, o Gefährte dessen, der keinen Gefährten hat, o Sicherheit dessen, der keine Sicherheit hat.",
                        slideNumber: "28"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا عاصِمُ يا قائِمُ يا دائِمُ يا راحِمُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Beschützer, o Währender, o Ewiger, o Erbarmer,",
                        slideNumber: "29"
                    },
                    {
                        arabic: "يا سالِمُ يا حاكِمُ يا عالِمُ يا قاسِمُ يا قابِضُ يا باسِطُ",
                        german: "o Unfehlbarer, o Regierender, o Allwissender, o Verteiler, o Begrenzender, o Ausbreitender.",
                        slideNumber: "29"
                    }
                ],
                [
                    {
                        arabic: "يا عاصِمَ مَنِ اسْتَعْصَمَهُ يا راحِمَ مَنِ اسْتَرْحَمَهُ يا غافِرَ مَنِ اسْتَغْفَرَهُ",
                        german: "o Beschützer derer, die Seinen Schutz suchen, o Erbarmer derer, die Ihn um Erbarmen anflehen, o Vergebender derer, die Seine Vergebung erhoffen",
                        slideNumber: "30"
                    },
                    {
                        arabic: "يا ناصِرَ مَنِ اسْتَنْصَرَهُ يا حافِظَ مَنِ اسْتَحْفَظَهُ يا مُكْرِمَ مَنِ اسْتَكْرَمَهُ",
                        german: "o Helfer derer, die Ihn um Hilfe ersuchen, o Hüter derer, die sich Seiner Obhut anvertrauen, o Wohltäter derer, die Seine Wohltaten erhoffen,",
                        slideNumber: "30"
                    },
                    {
                        arabic: "يا مُرْشِدَ مَنِ اسْتَرْشَدَهُ يا صَريخَ مَنِ اسْتَصْرَخَهُ",
                        german: "o Wegweiser derer, die nach Seiner Weisung verlangen, o Erlöser derer, die zu Ihm um Erlösung rufen,",
                        slideNumber: "30"
                    },
                    {
                        arabic: "يا مُعينَ مَنِ اسْتَعانَهُ يا مُغيثَ مَنِ اسْتَغاثَهُ",
                        german: "o Beistand derer, die Seinen Beistand ersehnen, o Erretter derer, die Ihn um Rettung ersuchen.",
                        slideNumber: "30"
                    }
                ],
                [
                    {
                        arabic: "يا عَزيزاً لا يُضامُ يا لَطيفاً لا يُرامُ يا قَيُّوماً لا يَنامُ يا دائِماً لا يَفُوتُ",
                        german: "o Mächtiger, Der nicht geschädigt werden kann, o Gütiger, Der unerreichbar ist, o Beständiger, Der niemals schläft, o Ewiger, Der niemals vergeht,",
                        slideNumber: "31"
                    },
                    {
                        arabic: "يا حَيّاً لا يَمُوتُ يا مَلِكاً لا يَزُولُ يا باقِياً لا يَفْنى",
                        german: "o Lebendiger, Der niemals stirbt, o König, Der niemals zugrunde geht, O Überlebender, Der niemals untergeht,",
                        slideNumber: "31"
                    },
                    {
                        arabic: "يا عالِماً لا يَجْهَلُ يا صَمَداً لا يُطْعَمُ يا قَوِيّاً لا يَضْعُفُ",
                        german: "o Allwissender, Der niemals unwissend ist, o Unabhängiger, Der nicht auf Nahrung angewiesen ist, o Starker, Der niemals schwach ist.",
                        slideNumber: "31"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَحَدُ يا واحِدُ يا شاهِدُ يا ماجِدُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Einziger, o Einer o Bezeugender, o Gerühmter,",
                        slideNumber: "32"
                    },
                    {
                        arabic: "يا حامِدُ يا راشِدُ يا باعِثُ يا وارِثُ يا ضارُّ يا نافِعُ",
                        german: "o Lobender, o Rechtleitender, o Lebenserweckender, o Erbe, o Schädigungsfähiger, o Wohltäter.",
                        slideNumber: "32"
                    }
                ],
                [
                    {
                        arabic: "يا اَعْظَمَ مِنْ كُلِّ عَظيمٍ يا اَكْرَمَ مِنْ كُلِّ كَريمٍ يا اَرْحَمَ مِنْ كُلِّ رَحيمٍ",
                        german: "o Gewaltigster aller Gewaltigen, o Großzügigster aller Großzügigen, o Gnädigster aller Begnadenden,",
                        slideNumber: "33"
                    },
                    {
                        arabic: "يا اَعْلَمَ مِنْ كُلِّ عَليمٍ يا اَحْكَمَ مِنْ كُلِّ حَكيمٍ يا اَقْدَمَ مِنْ كُلِّ قَديمٍ",
                        german: "o Wissendster aller Wissenden, o Höchstregierender aller Regierenden, o Existierender vor jeder Existenz,",
                        slideNumber: "33"
                    },
                    {
                        arabic: "يا اَكْبَرَ مِنْ كُلِّ كَبيرٍ يا اَلْطَفَ مِنْ كُلِّ لَطيفٍ يا اَجَلَّ مِن كُلِّ جَليلٍ يا اَعَزَّ مِنْ كُلِّ عَزيزٍ",
                        german: "o Größter aller Größen, o Gütigster aller Gütigen, o Majestätischster aller Majestätischen, o Kraftvollster aller Kraftvollen.",
                        slideNumber: "33"
                    }
                ],
                [
                    {
                        arabic: "يا كَريمَ الصَّفْحِ يا عَظيمَ الْمَنِّ يا كَثيرَ الْخَيْرِ يا قَديمَ الْفَضْلِ يا دائِمَ اللُّطْفِ يا لَطيفَ الصُّنْعِ",
                        german: "o großzügig Verzeihender, o Dessen Gunst groß ist, o Dessen Wohltaten viele sind, o Dessen Huld beständig ist, o Dessen Sanftmütigkeit ewig ist, o Dessen Handeln gütig ist",
                        slideNumber: "34"
                    },
                    {
                        arabic: "يا مُنَفِّسَ الْكَرْبِ يا كاشِفَ الضُّرِّ يا مالِكَ الْمُلْكِ يا قاضِيَ الْحَقِّ",
                        german: "o Erlöser vom Unheil, o Beseitigender des Schadens, o Eigentümer jedes Eigentums, o Richter des Rechts",
                        slideNumber: "34"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ هُوَ في عَهْدِهِ وَفِيٌّ يا مَنْ هُوَ في وَفائِهِ قَوِيٌّ يا مَنْ هُوَ في قُوَّتِهِ عَلِيٌّ",
                        german: "o Jener, Der Sein Versprechen erfüllt, o Jener, Der in der Erfüllung Seines Versprechens stark ist, o Jener, Der in Seiner Stärke erhaben ist,",
                        slideNumber: "35"
                    },
                    {
                        arabic: "يا مَنْ هُوَ في عُلُوِّهِ قَريبٌ يا مَنْ هُوَ في قُرْبِهِ لَطيفٌ يا مَنْ هُوَ في لُطْفِهِ شَريفٌ",
                        german: "o Jener, Der in Seiner Erhabenheit nah ist, o Jener, Der in Seiner Nähe gütig ist, o Jener, Der in Seiner Gütigkeit ehrenhaft ist,",
                        slideNumber: "35"
                    },
                    {
                        arabic: "يا مَنْ هُوَ في شَرَفِهِ عَزيزٌ يا مَنْ هُوَ في عِزِّهِ عَظيمٌ يا مَنْ هُوَ في عَظَمَتِهِ مَجيدٌ يا مَنْ هُوَ في مَجْدِهِ حَميدٌ",
                        german: "o Jener, Der in Seiner Ehrenhaftigkeit mächtig ist, o Jener, Der in Seiner Macht groß ist, o Jener, Der in Seiner Größe ruhmreich ist, o Jener, Der in Seinem Ruhm lobenswert ist.",
                        slideNumber: "35"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا كافي يا شافي يا وافى يا مُعافي",
                        german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Abwendender, o Heiler, o Genügender, o Schützer,",
                        slideNumber: "36"
                    },
                    {
                        arabic: "يا هادي يا داعي يا قاضي يا راضي يا عالي يا باقي",
                        german: "o Rechtleiter, o Einladender, o Richter, o Zufriedenstellender, o Hoher, o Überlebender.",
                        slideNumber: "36"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ كُلُّ شَيْءٍ خاضِعٌ لَهُ يا مَنْ كُلُّ شَيْءٍ خاشِعٌ لَهُ يا مَنْ كُلُّ شَيْءٍ كائِنٌ لَهُ",
                        german: "o Jener, Dem sich alles unterwirft, o Jener, gegenüber Dem alles demütig ist, o Jener, für Den alles existiert,",
                        slideNumber: "37"
                    },
                    {
                        arabic: "يا مَنْ كُلُّ شَيْءٍ مَوْجُودٌ بِهِ يا مَنْ كُلُّ شَيْءٍ مُنيبٌ اِلَيْهِ يا مَنْ كُلُّ شَيْءٍ خائِفٌ مِنْهُ",
                        german: "o Jener, durch Den alles existiert, o Jener, zu Dem alle Reue zeigen, o Jener, vor Dem sich alles fürchtet,",
                        slideNumber: "37"
                    },
                    {
                        arabic: "يا مَنْ كُلُّ شَيْءٍ قائِمٌ بِهِ يا مَنْ كُلُّ شَيْءٍ صائِرٌ اِلَيْهِ",
                        german: "o Jener, durch Den alles aufrecht ist, o Jener, zu Dem alles gelangt,",
                        slideNumber: "37"
                    },
                    {
                        arabic: "يا مَنْ كُلُّ شَيْءٍ يُسَبِّحُ بِحَمْدِهِ يا مَنْ كُلُّ شَيْءٍ هالِكٌ إلاّ وَجْهَهُ",
                        german: "o Jener, Den alles in Seiner Dankbarkeit lobpreist, o Jener, außer Dessen Antlitz alles untergeht.",
                        slideNumber: "37"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ لا مَفَرَّ إلاّ اِلَيْهِ يا مَنْ لا مَفْزَعَ إلاّ اِلَيْهِ يا مَنْ لا مَقْصَدَ إلاّ اِلَيْهِ",
                        german: "o Jener, außer Dem es keinen Ausweg gibt, o Jener, außer Dem es keinen Zufluchtsort gibt, o Jener, außer Dem es kein Ziel gibt,",
                        slideNumber: "38"
                    },
                    {
                        arabic: "يا مَنْ لا مَنْجا مِنْهُ إلاّ اِلَيْهِ يا مَنْ لا يُرْغَبُ إلاّ اِلَيْهِ يا مَنْ لا حَوْلَ وَلا قُوَّةَ إلاّ بِهِ",
                        german: "o Jener, außer Dem es keine Rettung gibt, o Jener, außer Dem nichts erwünscht wird, o Jener, außer durch Den es keine Kraft, noch Macht gibt,",
                        slideNumber: "38"
                    },
                    {
                        arabic: "يا مَنْ لا يُسْتَعانُ إلاّ بِهِ يا مَنْ لا يُتَوَكَّلُ إلاّ عَلَيْهِ يا مَنْ لا يُرْجى إلاّ هُوَ يا مَنْ لا يُعْبَدُ إلاّ هو",
                        german: "o Jener, außer Dem niemand um Hilfe gebeten wird, o Jener, außer Dem kein Verlass ist, o Jener, außer Dem niemand gebeten wird, o Jener, außer Dem niemand angebetet wird.",
                        slideNumber: "38"
                    }
                ],
                [
                    {
                        arabic: "يا خَيْرَ الْمَرْهُوبينَ يا خَيْرَ الْمَرْغُوبينَ يا خَيْرَ الْمَطْلُوبينَ",
                        german: "O Segenreichster der Gefürchteten, o Segenreichster der Erwünschten, o Segenreichster der Begehrten,",
                        slideNumber: "39"
                    },
                    {
                        arabic: "يا خَيْرَ الْمَسْؤولينَ يا خَيْرَ الْمَقْصُودينَ يا خَيْرَ الْمَذْكُورينَ",
                        german: "o Segenreichster der Verantwortlichen, o Segenreichster der Erstrebten, o Segenreichster der Erwähnten,",
                        slideNumber: "39"
                    },
                    {
                        arabic: "يا خَيْرَ الْمَشْكُورينَ يا خَيْرَ الْمحْبُوبينَ يا خَيْرَ الْمَدْعُوّينَ يا خَيْرَ الْمُسْتَأْنِسينَ",
                        german: "o Segenreichster der Gedankten, o Segenreichster der Geliebten, o Segenreichster der Angebetenen, o Segenreichster der Anvertrauten.",
                        slideNumber: "39"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا غافِرُ يا ساتِرُ يا قادِرُ يا قاهِرُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Vergebender, o Verhüller, o Mächtiger, o Bezwinger,",
                        slideNumber: "40"
                    },
                    {
                        arabic: "يا فاطِرُ يا كاسِرُ يا جابِرُ يا ذاكِرُ يا ناظِرُ يا ناصِرُ",
                        german: "o Schöpfer, o Besiegender, o Zwingender, o Erwähnender, o Prüfender, o Unterstützer.",
                        slideNumber: "40"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ خَلَقَ فَسَوّى يا مَنْ قَدَّرَ فَهَدى يا مَنْ يَكْشِفُ الْبَلْوى",
                        german: "o Jener, Der erschaffen und geordnet hat, o Jener, Der bestimmt und den rechten Weg gewiesen hat, o Jener, Der das Unheil beseitigt,",
                        slideNumber: "41"
                    },
                    {
                        arabic: "يا مَنْ يَسْمَعُ النَّجْوى يا مَنْ يُنْقِذُ الْغَرْقى يا مَنْ يُنْجِي الْهَلْكى",
                        german: "o Jener, Der die heimlichen Unterredungen hört, o Jener, Der die Ertrinkenden rettet, o Jener, Der die zu Grunde Gehenden birgt,",
                        slideNumber: "41"
                    },
                    {
                        arabic: "يا مَنْ يَشْفِي الْمَرْضى يا مَنْ اَضْحَكَ وَاَبْكى",
                        german: "o Jener, Der die Kranken heilt, o Jener, Der lachen und weinen lässt,",
                        slideNumber: "41"
                    },
                    {
                        arabic: "يا مَنْ اَماتَ وَاَحْيى يا مَنْ خَلَقَ الزَّوْجَيْنِ الذَّكَرَ وَالاْنْثى",
                        german: "o Jener, Der leben und sterben lässt, o Jener, Der die Paare erschaffen hat, das Männliche und das Weibliche.",
                        slideNumber: "41"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ فيِ الْبَرِّ وَالْبَحْرِ سَبيلُهُ يا مَنْ فِي الاْفاقِ اياتُهُ يا مَنْ فِي الاْياتِ بُرْهانُهُ",
                        german: "o Jener, Dem zu Land und zu Wasser Wege offen stehen, o Jener, Dessen Zeichen an den Horizonten sind, o Jener, Dessen Beweis in den Zeichen liegt,",
                        slideNumber: "42"
                    },
                    {
                        arabic: "يا مَنْ فِي الْمَماتِ قُدْرَتُهُ يا مَنْ فِي الْقُبُورِ عِبْرَتُهُ يا مَنْ فِي الْقِيامَةِ مُلْكُهُ",
                        german: "o Jener, Dessen Macht sich im Tode zeigt, o Jener, Dessen Lehre sich in den Gräbern zeigt, o Jener, Dessen Herrschaft sich in der Auferstehung zeigt,",
                        slideNumber: "42"
                    },
                    {
                        arabic: "يا مَنْ فِي الْحِسابِ هَيْبَتُهُ يا مَنْ فِي الْميزانِ قَضاؤُهُ يا مَنْ فِي الْجَنَّةِ ثَوابُهُ يا مَنْ فِي النّارِ عِقابُهُ",
                        german: "o Jener, Dessen Ehrfurchtgebietung sich in der Rechenschaft zeigt, o Jener, Dessen Urteil sich auf der Waage zeigt, o Jener, Dessen Belohnung sich im Paradies zeigt, o Jener, Dessen Bestrafung sich in der Feuer zeigt.",
                        slideNumber: "42"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ اِلَيْهِ يَهْرَبُ الْخائِفُونَ يا مَنْ اِلَيْهِ يَفْزَعُ الْمُذْنِبُونَ يا مَنْ اِلَيْهِ يَقْصِدُ الْمُنيبُونَ",
                        german: "o Jener, zu Dem die Verängstigten fliehen, o Jener, bei dem die Sünder Zuflucht suchen, o Jener, an Den sich die Bereuenden wenden,",
                        slideNumber: "43"
                    },
                    {
                        arabic: "يا مَنْ اِلَيْهِ يَرْغَبُ الزّاهِدُونَ يا مَنْ اِلَيْهِ يَلْجَأُ الْمُتَحَيِّرُونَ يا مَنْ بِهِ يَسْتَأْنِسُ الْمُريدُونَ",
                        german: "o Jener, den die Welt-Entsagenden begehren, o Jener, zu Dem die Verwirrten fliehen, o Jener, Den diejenigen, die nach Ihm verlangen, vertrauen,",
                        slideNumber: "43"
                    },
                    {
                        arabic: "يا مَنْ بِه يَفْتَخِرُ الْمحِبُّونَ يا مَنْ في عَفْوِهِ يَطْمَعُ الْخاطِئُونَ",
                        german: "o Jener, auf Den die Liebenden stolz sind, o Jener, Dessen Verzeihung die Fehlerhaften wünschen,",
                        slideNumber: "43"
                    },
                    {
                        arabic: "يا مَنْ اِلَيْهِ يَسْكُنُ الْمُوقِنُونَ يا مَنْ عَلَيْهِ يَتَوَكَّلُ الْمُتَوَكِّلُونَ",
                        german: "o Jener, bei Dem die mit Gewissheit Ruhe finden, o Jener, auf Den die Vertrauenden vertrauen.",
                        slideNumber: "43"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا حَبيبُ يا طَبيبُ يا قَريبُ يا رَقيبُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Geliebter, o Heiler o Naher, o Beobachter",
                        slideNumber: "44"
                    },
                    {
                        arabic: "يا حَسيبُ يا مُهيبُ يا مُثيبُ يا مُجيبُ يا خَبيرُ يا نَصِيرُ",
                        german: "o Abrechnender, o Ehrfurchtsgebietender, o Belohnender, o Erfüllender o Erfahrener, o Allsehender.",
                        slideNumber: "44"
                    }
                ],
                [
                    {
                        arabic: "يا اَقَرَبَ مِنْ كُلِّ قَريبٍ يا اَحَبَّ مِنْ كُلِّ حَبيبٍ يا اَبْصَرَ مِنْ كُلِّ بَصيرٍ",
                        german: "o Nächster aller Nahen, o Geliebtester aller Geliebten, o Sehendster aller Sehenden,",
                        slideNumber: "45"
                    },
                    {
                        arabic: "يا اَخْبَرَ مِنْ كُلِّ خَبيرٍ يا اَشْرَفَ مِنْ كُلِّ شَريفٍ يا اَرْفَعَ مِنْ كُلِّ رَفيعٍ",
                        german: "o Erfahrenster aller Erfahrenen, o Ehrenhaftester aller Ehrenhaften, o Hochrangigster aller Hochrangigen,",
                        slideNumber: "45"
                    },
                    {
                        arabic: "يا اَقْوى مِنْ كُلِّ قَوِيٍّ يا اَغْنى مِنْ كُلِّ غَنِيٍّ يا اَجْوَدَ مِنْ كُلِّ جَوادٍ يا اَرْاَفَ مِنْ كُلِّ رَؤوُفٍ",
                        german: "o Kraftvollster aller Kraftvollen, o Reichster aller Reichen, o Freigebigster aller Freigebigen, o Erbarmendster aller Erbarmenden.",
                        slideNumber: "45"
                    }
                ],
                [
                    {
                        arabic: "يا غالِباً غَيْرَ مَغْلُوبٍ يا صانِعاً غَيْرَ مَصْنُوعٍ يا خالِقاً غَيْرَ مَخْلُوقٍ",
                        german: "o Sieger ohne Niederlage, o Erschaffer ohne erschaffen zu sein, o Schöpfer ohne geschöpft worden zu sein,",
                        slideNumber: "46"
                    },
                    {
                        arabic: "يا مالِكاً غَيْرَ مَمْلُوكٍ يا قاهِراً غَيْرَ مَقْهُورٍ يا رافِعاً غَيْرَ مَرْفُوعٍ",
                        german: "o Besitzer, ohne Eigentum zu sein, o Bezwinger, ohne bezwungen zu werden, o Erhöhender, ohne erhöht zu werden,",
                        slideNumber: "46"
                    },
                    {
                        arabic: "يا حافِظاً غَيْرَ مَحْفُوظٍ يا ناصِراً غَيْرَ مَنْصُورٍ",
                        german: "o Bewahrer, ohne bewahrt zu werden, o Unterstützer, ohne unterstützt zu werden,",
                        slideNumber: "46"
                    },
                    {
                        arabic: "يا شاهِداً غَيْرَ غائِبٍ يا قَريباً غَيْرَ بَعيدٍ",
                        german: "o Zeuge, ohne abwesend zu sein, o Naher, ohne fern zu sein.",
                        slideNumber: "46"
                    }
                ],
                [
                    {
                        arabic: "يا نُورَ النُّورِ يا مُنَوِّرَ النُّورِ يا خالِقَ النُّورِ",
                        german: "o Licht des Lichtes, o Erleuchtender des Lichtes, o Schöpfer des Lichtes,",
                        slideNumber: "47"
                    },
                    {
                        arabic: "يا مُدَبِّرَ النُّورِ يا مُقَدِّرَ النُّورِ يا نُورَ كُلِّ نُورٍ",
                        german: "o Gestalter des Lichtes, o Abschätzer des Lichtes, o Licht jedes Lichtes,",
                        slideNumber: "47"
                    },
                    {
                        arabic: "يا نُوراً قَبْلَ كُلِّ نُورٍ يا نُوراً بَعْدَ كُلِّ نُورٍ",
                        german: "o Licht, das vor jedem Licht da war, o Licht, das nach jedem Licht da sein wird,",
                        slideNumber: "47"
                    },
                    {
                        arabic: "يا نُوراً فَوْقَ كُلِّ نُورٍ يا نُوراً لَيْسَ كَمِثْلِهِ نُورٌ",
                        german: "o Licht, das über allen Lichtern steht, o Licht, dem kein Licht ebenbürtig ist.",
                        slideNumber: "47"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ عَطاؤُهُ شَريفٌ يا مَنْ فِعْلُهُ لَطيفٌ يا مَنْ لُطْفُهُ مُقيمٌ",
                        german: "o Jener, Dessen Gaben ehrenhaft sind, o Jener, Dessen Handeln nachsichtig ist, o Jener, Dessen Nachsicht beständig ist,",
                        slideNumber: "48"
                    },
                    {
                        arabic: "يا مَنْ اِحْسانُهُ قَديمٌ يا مَنْ قَوْلُهُ حَقٌّ يا مَنْ وَعْدُهُ صِدْقٌ",
                        german: "o Jener, Dessen Wohltätigkeit von jeher bestehend ist, o Jener, Dessen Wort die Wahrheit ist, o Jener, Dessen Versprechen aufrichtig ist,",
                        slideNumber: "48"
                    },
                    {
                        arabic: "يا مَنْ عَفْوُهُ فَضْلٌ يا مَنْ عَذابُهُ عَدْلٌ",
                        german: "o Jener, Dessen Vergebung Huld ist, o Jener, Dessen Bestrafung gerecht ist,",
                        slideNumber: "48"
                    },
                    {
                        arabic: "يا مَنْ ذِكْرُهُ حُلْوٌ يا مَنْ فَضْلُهُ عَميمٌ",
                        german: "o Jener, Dessen Erwähnung süß ist, o Jener, Dessen Huld umfassend ist.",
                        slideNumber: "48"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُسَهِّلُ يا مُفَصِّلُ يا مُبَدِّلُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Erleichterer, o Verdeutlicher, o Verwandler,",
                        slideNumber: "49"
                    },
                    {
                        arabic: "يا مُذَلِّلُ يا مُنَزِّلُ يا مُنَوِّلُ يا مُفْضِلُ يا مُجْزِلُ يا مُمْهِلُ يا مُجْمِلُ",
                        german: "o Demütigender, o Herabsender, o Verschaffer, o Huldvoller, o Freigiebiger, o Verschonender, o Verleiher von Schönheit.",
                        slideNumber: "49"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ يَرى وَلا يُرى يا مَنْ يَخْلُقُ وَلا يُخْلَقُ يا مَنْ يَهْدي وَلا يُهْدى",
                        german: "o Jener, Der sieht, Er aber nicht sichtbar ist, o Jener, der erschafft, Er aber nicht erschaffen ist, o Jener, Der den rechten Weg weist, Dem aber nicht der Weg gewiesen wird,",
                        slideNumber: "50"
                    },
                    {
                        arabic: "يا مَنْ يُحْيي وَلا يُحْيا يا مَنْ يَسْأَلُ وَلا يُسْأَلُ يا مَنْ يُطْعِمُ وَلا يُطْعَمُ",
                        german: "o jener, Der zum Leben erweckt, Er aber nicht zum Leben erweckt wird, o Jener, Der fragt, Er aber nicht befragt wird, o Jener, Der speist, Er aber nicht gespeist wird,",
                        slideNumber: "50"
                    },
                    {
                        arabic: "يا مَنْ يُجيرُ وَلا يُجارُ عَلَيْهِ يا مَنْ يَقْضي وَلا يُقْضى عَلَيْهِ",
                        german: "o Jener, Der Schutz gebietet, vor Dem es aber keinen Schutz gibt, o Jener, Der richtet, über Den aber nicht gerichtet wird,",
                        slideNumber: "50"
                    },
                    {
                        arabic: "يا مَنْ يَحْكُمُ وَلا يُحْكَمُ عَلَيْهِ يا مَنْ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُنْ لَهُ كُفُواً اَحَدٌ",
                        german: "o Jener, Der urteilt, über Ihn aber nicht geurteilt wird, o Jener, Der nicht zeugt und nicht gezeugt worden ist, und Ihm ebenbürtig ist keiner.",
                        slideNumber: "50"
                    }
                ],
                [
                    {
                        arabic: "يا نِعْمَ الْحَسيبُ يا نِعْمَ الطَّبيبُ يا نِعْمَ الرَّقيبُ يا نِعْمَ الْقَريبُ يا نِعْمَ الْمـٌجيبُ",
                        german: "o vortrefflichster Abrechnender, o vortrefflichster Heiler, o vortrefflichster Beobachter, o vortrefflichster Naher, o vortrefflichster Erfüllender,",
                        slideNumber: "51"
                    },
                    {
                        arabic: "يا نِعْمَ الْحَبيبُ يا نِعْمَ الْكَفيلُ يا نِعْمَ الَوْكيلُ يا نِعْمَ الْمَوْلى يا نِعْمَ النَّصيرُ",
                        german: "o vortrefflichster Geliebter, o vortrefflichster Garant, o vortrefflichster Treuhänder, o vortrefflichster Gebieter, o vortrefflicher Beisteher.",
                        slideNumber: "51"
                    }
                ],
                [
                    {
                        arabic: "يا سُرُورَ الْعارِفينَ يا مُنَى الْمحِبّينَ يا اَنيسَ الْمُريدينَ يا حَبيبَ التَّوّابينَ",
                        german: "o Freude der Erkennenden, o Endwunsch der Liebenden, o Vertrauter der Anstrebenden, o Geliebter der Reumütigen,",
                        slideNumber: "52"
                    },
                    {
                        arabic: "يا رازِقَ الْمُقِلّينَ يا رَجاءَ الْمُذْنِبينَ يا قُرَّةَ عَيْنِ الْعابِدينَ يا مُنَفِّسُ عَنِ الْمَكْرُوبينَ",
                        german: "o Ernährer der Besitzlosen, o Hoffnung der Sünder, o Augentrost der Anbetenden, o Erleichternder der Besorgten,",
                        slideNumber: "52"
                    },
                    {
                        arabic: "يا مُفَرِّجُ عَنِ الْمَغْمُومينَ يا اِلـهَ الاْوَّلينَ وَالآخِرينَ",
                        german: "o Erlöser der Bekümmerten, o Gott der Ersten und der Letzten.",
                        slideNumber: "52"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا رَبَّنا يا اِلهَنا يا سَيِّدَنا يا مَوْلانا",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o unser Herr, o unser Gott, o unser Meister, o unser Gebieter,",
                        slideNumber: "53"
                    },
                    {
                        arabic: "يا ناصِرَنا يا حافِظَنا يا دَليلَنا يا مُعينَنا يا حَبيبَنا يا طَبيبَنا",
                        german: "o unser Unterstützer, o unser Behüter, o unser Wegweiser, o unser Helfer, o unser Liebling, o unser Heiler.",
                        slideNumber: "53"
                    }
                ],
                [
                    {
                        arabic: "يا رَبَّ النَّبيّينَ وَالاْبْرارِ يا رَبَّ الصِّدّيقينَ وَالاْخْيارِ يا رَبَّ الْجَنَّةِ وَالنّارِ",
                        german: "o Herr der Propheten und der Rechtschaffenen, o Herr der Wahrheitsliebenden und der Auserwählten, o Herr des Paradieses und der Hölle",
                        slideNumber: "54"
                    },
                    {
                        arabic: "يا رَبَّ الصِّغارِ وَالْكِبارِ يا رَبَّ الْحُبُوبِ وَالِّثمارِ يا رَبَّ الاْنْهارِ وَالاْشْجار",
                        german: "o Herr der Kleinen und der Großen, o Herr der Samenkörner und der Früchte, o Herr der Flüsse und der Bäume",
                        slideNumber: "54"
                    },
                    {
                        arabic: "يا رَبَّ الصَّحاري وَالْقِفارِ يا رَبَّ الْبَراري وَالْبِحار",
                        german: "o Herr der Wüsten und der Steppen, o Herr des Festlandes und der Meere,",
                        slideNumber: "54"
                    },
                    {
                        arabic: "يا رَبَّ اللَّيْلِ وَالنَّهارِ يا رَبَّ الاْعْلانِ وَالاْسْرارِ",
                        german: "o Herr der Nacht und des Tages, o Herr des Offengelegten und des Geheimen.",
                        slideNumber: "54"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ نَفَذَ في كُلِّ شَيْءٍ اَمْرُهُ يا مَنْ لَحِقَ بِكُلِّ شَيْءٍ عِلْمُهُ يا مَنْ بَلَغَتْ اِلى كُلِّ شَيْءٍ قُدْرَتُهُ",
                        german: "o Jener, Dessen Befehl alles unterliegt, o Jener, Dessen Wissen alles umfasst, o Jener, Dessen Macht an alles heranreicht,",
                        slideNumber: "55"
                    },
                    {
                        arabic: "يا مَنْ لا تُحْصِي الْعِبادُ نِعَمَهُ يا مَنْ لا تَبْلُغُ الْخَلائِقُ شُكْرَهُ يا مَنْ لا تُدْرِكُ الاْفْهامُ جَلالَهُ",
                        german: "o Jener, Dessen Gunst die Diener nicht ermessen können, o Jener, Dessen Dank die Geschöpfe nicht erlangen können, o Jener, Dessen Pracht das Begriffsvermögen nicht erfassen kann,",
                        slideNumber: "55"
                    },
                    {
                        arabic: "يا مَنْ لا تَرُدُّ الْعِبادُ قَضاءَهُ يا مَنْ لا مُلْكَ إلاّ مُلْكُهُ يا مَنْ لا عَطاءَ إلاّ عَطاؤُهُ",
                        german: "o Jener, Dessen Richtspruch die Diener nicht abwenden können, o Jener, außer Dessen Herrschaft es keine Herrschaft gibt, o Jener, außer Dessen Gaben es keine Gaben gibt.",
                        slideNumber: "55"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ لَهُ الْمَثَلُ الاْعْلى يا مَنْ لَهُ الصِّفاتُ الْعُلْيا يا مَنْ لَهُ الاْخِرَةُ وَالاْولى",
                        german: "o Jener, Dem die höchsten Ideale gehören, o Jener, Dem die höchsten Eigenschaften gehören, o Jener, Dem das Jenseits und das Diesseits gehören,",
                        slideNumber: "56"
                    },
                    {
                        arabic: "يا مَنْ لَهُ الْجَنَّةُ الْمَأوى يا مَنْ لَهُ الآياتُ الْكُبْرى يا مَنْ لَهُ الاْسْماءُ الْحُسْنى",
                        german: "o Jener, Dem die Behausungen des Paradieses gehören, o Jener, Dem die größten Zeichen gehören, o Jener, Dem die schönsten Namen gehören,",
                        slideNumber: "56"
                    },
                    {
                        arabic: "يا مَنْ لَهُ الْحُكْمُ وَالْقَضاءُ يا مَنْ لَهُ الْهَواءُ وَالْفَضاءُ يا مَنْ لَهُ الْعَرْشُ وَالثَّرى يا مَنْ لَهُ السَّماواتُ الْعُلى",
                        german: "o Jener, Dem das Urteil und der Richtspruch gehören, o Jener, Dem die Atmosphäre und der Weltraum gehören, o Jener, Dem der Thron und die Erde gehören, o Jener, Dem die höchsten Himmel gehören.",
                        slideNumber: "56"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا عَفُوُّ يا غَفُورُ يا صَبُورُ يا شَكُورُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Vergebender, o Verzeihender, o Geduldiger, o Dankbarer,",
                        slideNumber: "57"
                    },
                    {
                        arabic: "يا رَؤوفُ يا عَطُوفُ يا مَسْؤولُ يا وَدُودُ يا سُبُّوحُ يا قُدُّوسُ",
                        german: "o Gnädiger, o Nachsichtiger, o Verantwortlicher, o Liebevoller, o Lobgepriesenster, o Heiligster.",
                        slideNumber: "57"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ فِي السَّماءِ عَظَمَتُهُ يا مَنْ فِي الاْرْضِ آياتُهُ يا مَنْ في كُلِّ شَيْءٍ دَلائِلُهُ",
                        german: "o Jener, Dessen Gewaltigkeit im Himmel offenbar wird, o Jener, Dessen Zeichen auf der Erde sind, o Jener, Dessen Beweise in allem offenbar sind,",
                        slideNumber: "58"
                    },
                    {
                        arabic: "يا مَنْ فِي الْبِحارِ عَجائِبُهُ يا مَنْ فِي الْجِبالِ خَزائِنُهُ يا مَنْ يَبْدَأُ الْخَلْقَ ثُمَّ يُعيدُهُ",
                        german: "o Jener, Dessen Wunder in den Meeren sind, o Jener, Dessen Schatztruhen in den Bergen sind, o Jener, Der die Schöpfung erschafft und sie dann zurückkehren lässt,",
                        slideNumber: "58"
                    },
                    {
                        arabic: "يا مَنْ اِلَيْهِ يَرْجِـعُ الاْمْرُ كُلُّهُ يا مَنْ اَظْهَرَ في كُلِّ شَيْءٍ لُطْفَهُ",
                        german: "o Jener, auf Den die ganze Befehlsgewalt zurückgeht, o Jener, Dessen Nachsicht sich in allem zeigt,",
                        slideNumber: "58"
                    },
                    {
                        arabic: "يا مَنْ اَحْسَنَ كُلَّ شَيْءٍ خَلْقَهُ يا مَنْ تَصَرَّفَ فِي الْخَلائِقِ قُدْرَتُهُ",
                        german: "o Jener, Der alles in seiner Schöpfung schön gemacht hat, o Jener, Dessen Macht frei über die Geschöpfe verfügt.",
                        slideNumber: "58"
                    }
                ],
                [
                    {
                        arabic: "يا حَبيبَ مَنْ لا حَبيبَ لَهُ يا طَبيبَ مَنْ لا طَبيبَ لَهُ يا مُجيبَ مَنْ لا مُجيبَ لَهُ",
                        german: "o Geliebter dessen, der keinen Geliebten hat, o Heiler dessen, der keinen Heiler hat, o Erfüllender dessen, der keinen Erfüllenden hat,",
                        slideNumber: "59"
                    },
                    {
                        arabic: "يا شَفيقَ مَنْ لا شَفيقَ لَهُ يا رَفيقَ مَنْ لا رَفيقَ لَهُ يا مُغيثَ مَن لا مُغيثَ لَهُ",
                        german: "o Mitleidiger dessen, der keinen Mitleidigen hat, o Begleiter dessen, der keinen Begleiter hat, o Retter dessen, der keinen Retter hat,",
                        slideNumber: "59"
                    },
                    {
                        arabic: "يا دَليلَ مَنْ لا دَليلَ لَهُ يا اَنيسَ مَنْ لا اَنيسَ لَهُ",
                        german: "o Wegweiser dessen, der keinen Wegweiser hat, o Tröster dessen, der keinen Tröster hat,",
                        slideNumber: "59"
                    },
                    {
                        arabic: "يا راحِمَ مَنْ لا راحِمَ لَهُ يا صاحِبَ مَنْ لا صاحِبَ لَهُ",
                        german: "o Erbarmer dessen, der keinen Erbarmer hat, o Gefährte dessen, der keinen Gefährten hat.",
                        slideNumber: "59"
                    }
                ],
                [
                    {
                        arabic: "يا كافِيَ مَنِ اسْتَكْفاهُ يا هادِيَ مَنِ اسْتَهْداهُ يا كالِىءَ مَنِ اسْتَكْلاهُ",
                        german: "o Genügender dessen, der Ihn um Genüge bittet, o Wegweiser dessen, der Ihn um Wegweisung bittet, o Beschützer dessen, der Ihn um Schutz bittet,",
                        slideNumber: "60"
                    },
                    {
                        arabic: "يا راعِيَ مَنِ اسْتَرْعاهُ يا شافِيَ مَنِ اسْتَشْفاهُ يا قاضِيَ مَنِ اسْتَقْضاهُ",
                        german: "o Behüter dessen, der Ihn um Behütung bittet, o Heiler dessen, der Ihn um Heilung bittet, o Richter dessen, der Ihn um Richtspruch bittet",
                        slideNumber: "60"
                    },
                    {
                        arabic: "يا مُغْنِيَ مَنِ اسْتَغْناهُ يا مُوفِيَ مَنِ اسْتَوْفاهُ يا مُقَوِّيَ مَنِ اسْتَقْواهُ يا وَلِيَّ مَنِ اسْتَوْلاهُ",
                        german: "o Bereichernder dessen, der Ihn um Reichtum bittet, o reich Beschenkender dessen, der Ihn um reiche Schenkung bittet, o Stärkender dessen, der Ihn um Stärkung bittet, o Beistand dessen, der Ihn um Beistand bittet.",
                        slideNumber: "60"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا خالِقُ يا رازِقُ يا ناطِقُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Schöpfer, o Versorger, o Erlassender,",
                        slideNumber: "61"
                    },
                    {
                        arabic: "يا صادِقُ يا فالِقُ يا فارِقُ يا فاتِقُ يا راتِقُ يا سابِقُ يا سامِقُ",
                        german: "o Wahrhaftiger, o Aufspaltender, o Unterscheider, o Trennender, o Aufreißender, o Vorangehender, o Hochragender.",
                        slideNumber: "61"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ يُقَلِّبُ اللَّيْلَ وَالنَّهارَ يا مَنْ جَعَلَ الظُّلُماتِ وَالأَنْوارَ يا مَنْ خَلَقَ الظِّلَّ وَالْحَرُورَ",
                        german: "o Jener, Der die Nacht und den Tag einander abwechseln lässt, o Jener, Der die Dunkelheit und das Licht erschuf, o Jener, Der die Schatten und die Hitze hervorbrachte,",
                        slideNumber: "62"
                    },
                    {
                        arabic: "يا مَنْ سَخَّرَ الشَّمْسَ وَالْقَمَرَ يا مَنْ قَدَّرَ الْخَيْرَ وَالشَّرَّ يا مَنْ خَلَقَ الْمَوْتَ وَالْحَياةَ",
                        german: "o Jener, Der die Sonne und den Mond dienstbar machte, o Jener, Der das Gute und das Schlechte bemessen hat, o Jener, Der den Tod und das Leben erschuf,",
                        slideNumber: "62"
                    },
                    {
                        arabic: "يا مَنْ لَهُ الْخَلْقُ وَالاْمْرُ يا مَنْ لَمْ يَتَّخِذْ صاحِبَةً وَلا وَلَداً",
                        german: "o Jener, Dem die Schöpfung und die Befehlsgewalt gehören, o Jener, Der Sich weder Gefährtin noch ein Kind nimmt,",
                        slideNumber: "62"
                    },
                    {
                        arabic: "يا مَنْ لَيْسَ لَهُ شَريكٌ في الْمُلْكِ يا مَنْ لَمْ يَكُنْ لَهُ وَلِيٌّ مِنَ الذُّلِّ",
                        german: "o Jener, Der keinen Partner bei der Herrschaft hat, o Jener, Der keinen Gebieter hat, der Ihn vor Demütigung bewahrt.",
                        slideNumber: "62"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ يَعْلَمُ مُرادَ الْمُريدينَ يا مَنْ يَعْلَمُ ضَميرَ الصّامِتينَ يا مَنْ يَسْمَعُ اَنينَ الْواهِنينَ",
                        german: "o Jener, Der das Ziel der Anstrebenden kennt, o Jener, Der das Innere der Schweigenden kennt, o Jener, Der das Leiden der Geschwächten hört,",
                        slideNumber: "63"
                    },
                    {
                        arabic: "يا مَنْ يَرى بُكاءَ الْخائِفينَ يا مَنْ يَمْلِكُ حَوائِجَ السّائِلينَ يا مَنْ يَقْبَلُ عُذْرَ التّائِبينَ",
                        german: "o Jener, Der das Weinen der Verängstigten sieht, o Jener, Der das Anliegen der Bittenden besitzt, o Jener, Der die Entschuldigung der Reumütigen annimmt,",
                        slideNumber: "63"
                    },
                    {
                        arabic: "يا مَنْ لا يُصْلِحُ عَمَلَ الْمُفْسِدينَ يا مَنْ لا يُضيعُ اَجْرَ الْمـٌحْسِنينَ",
                        german: "o Jener, Der die Taten der Verderber nicht gelingen lässt, o Jener, Der die Werke der Rechtschaffenen nicht verkommen lässt,",
                        slideNumber: "63"
                    },
                    {
                        arabic: "يا مَنْ لا يَبْعُدُ عَنْ قُلُوبِ الْعارِفينَ يا اَجْوَدَ الاْجْودينَ",
                        german: "o Jener, Der sich von den Herzen der Erkennenden nicht entfernt, o Großzügigster der Großzügigen.",
                        slideNumber: "63"
                    }
                ],
                [
                    {
                        arabic: "يا دائِمَ الْبَقاءِ يا سامِعَ الدُّعاءِ يا واسِعَ الْعَطاءِ يا غافِرَ الْخَطاءِ",
                        german: "o Dessen Ewigkeit immer währt, o Erhörer des Bittgebets, o Dessen Gaben reichlich sind, o Verzeihender der Fehler,",
                        slideNumber: "64"
                    },
                    {
                        arabic: "يا بَديعَ السَّماءِ يا حَسَنَ الْبَلاءِ يا جَميلَ الثَّناءِ يا قَديمَ السَّناءِ",
                        german: "o Schöpfer des Himmels, o Dessen Prüfung gut ist, o Dessen Lob schön ist, o Dessen Glanz von je her besteht,",
                        slideNumber: "64"
                    },
                    {
                        arabic: "يا كَثيرَ الْوَفاءِ يا شَريفَ الْجَزاء",
                        german: "o Dessen Treue groß ist, o Dessen Belohnung ehrenhaft ist.",
                        slideNumber: "64"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا سَتّارُ يا غَفّارُ يا قَهّارُ",
                        german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Verhüller, o Verzeihender, o Bezwinger, o Allgewaltiger,",
                        slideNumber: "65"
                    },
                    {
                        arabic: "يا جَبّارُ يا صَبّارُ يا بارُّ يا مُخْتارُ يا فَتّاحُ يا نَفّاحُ يا مُرْتاحُ",
                        german: "o Langmütiger, o Gütiger, o Auserwählender, o Eröffnender, o Beschenkender, o Zufriedener.",
                        slideNumber: "65"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ خَلَقَني وَسَوّاني يا مَنْ رَزَقَني وَرَبّاني يا مَنْ اَطْعَمَني وَسَقاني",
                        german: "o Jener, Der mich erschaffen und geformt hat, o Jener, Der mich versorgt und aufgezogen hat o Jener, Der mich mit Speisen und Getränken versorgt hat,",
                        slideNumber: "66"
                    },
                    {
                        arabic: "يا مَنْ قَرَّبَني وَ اَدْناني يا مَنْ عَصَمَني وَكَفاني يا مَنْ حَفِظَني وَكَلاني",
                        german: "o Jener, Der mich angenähert und herangerückt hat, o Jener, Der mich beschützt und Genüge getan hat, o Jener, Der mich behütet und bewahrt hat,",
                        slideNumber: "66"
                    },
                    {
                        arabic: "يا مَنْ اَعَزَّني وَاَغْناني يا مَنْ وَفَّقَني وَهَداني يا مَنْ آنَسَني وَآوَاني يا مَنْ اَماتَني وَاَحْياني",
                        german: "o Jener, Der mich gestärkt und bereichert hat, o Jener, Der mir Erfolg geschenkt und rechtgeleitet hat, o Jener, Der mich getröstet und mir Unterkunft gewährt hat, o Jener, Der mich sterben Und wieder leben lässt.",
                        slideNumber: "66"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ يُحِقُّ الْحَقَّ بِكَلِماتِهِ يا مَنْ يَقْبَلُ التَّوْبَةَ عَنْ عِبادِهِ يا مَنْ يَحُولُ بَيْنَ الْمَرْءِ وَقَلْبِهِ",
                        german: "o Jener, Der mit Seinen Worten die Wahrheit bestätigt, o Jener, Der die Reue Seiner Diener annimmt, o Jener, Der zwischen dem Menschen und seinem Herzen steht,",
                        slideNumber: "67"
                    },
                    {
                        arabic: "يا مَنْ لا تَنْفَعُ الشَّفاعَةُ إلاّ بِاِذْنِهِ يا مَنْ هُوَ اَعْلَمُ بِمَنْ ضَلَّ عَنْ سَبيلِهِ يا مَنْ لا مُعَقِّبَ لِحُكْمِهِ",
                        german: "o Jener, ohne Dessen Erlaubnis keine Fürsprache Erfolg hat, o Jener, Der am besten weiß über jene, die von Seinem Weg abgewichen sind, o Jener, Dessen Urteil nicht zurückgewiesen werden kann",
                        slideNumber: "67"
                    },
                    {
                        arabic: "يا مَنْ لا رادَّ لِقَضائِهِ يا مَنِ انْقادَ كُلُّ شَيْءٍ لأَمْرِهِ",
                        german: "o Jener, Dessen Richtspruch nicht in Frage gestellt werden kann, o Jener, Dessen Befehl alles unterlegen ist,",
                        slideNumber: "67"
                    },
                    {
                        arabic: "يا مَنِ السَّماواتُ مَطْوِيّاتٌ بِيَمينِهِ يا مَنْ يُرْسِلُ الرِّياحَ بُشْراً بَيْنَ يَدَيْ رَحْمَتِهِ",
                        german: "o Jener, in Dessen Rechter die Himmel zusammengelegt sind, o Jener, Der die Winde als Vorboten Seiner Gnade bei Ihm schickt.",
                        slideNumber: "67"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ جَعَلَ الاْرْضَ مِهاداً يا مَنْ جَعَلَ الْجِبالَ اَوْتاداً يا مَنْ جَعَلَ الشَّمْسَ سِراجاً",
                        german: "o Jener, Der die Erde ausgewogen errichtet hat, o Jener, Der die Berge zu Pflöcken errichtet hat, o Jener, Der die Sonne zu einer Leuchte errichtet hat,",
                        slideNumber: "68"
                    },
                    {
                        arabic: "يا مَنْ جَعَلَ الْقَمَرَ نُوراً يا مَنْ جَعَلَ اللَّيْلَ لِباساً يا مَنْ جَعَلَ النَّهارَ مَعاشاً",
                        german: "o Jener, Der den Mond zum Licht errichtet hat, o Jener, Der die Nacht zu einem Gewand errichtet hat, o Jener, Der den Tag zum Zusammenleben errichtet hat,",
                        slideNumber: "68"
                    },
                    {
                        arabic: "يا مَنْ جَعَلَ النَّوْمَ سُباتاً يا مَنْ جَعَلَ السَّمآءَ بِناءً يا مَنْ جَعَلَ الاْشْياءَ اَزْواجاً يا مَنْ جَعَلَ النّارَ مِرْصاداً",
                        german: "o Jener, Der den Schlaf zum Ausruhen errichtet hat, o Jener, Der den Himmel zum Erbauten errichtet hat, o Jener, Der die Dinge als Paare errichtet hat, o Jener, Der das Feuer zu einer Wacht errichtet hat.",
                        slideNumber: "68"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا سَميعُ يا شَفيعُ يا رَفيعُ",
                        german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Allhörender, o Fürsprecher, o Angesehener,",
                        slideNumber: "69"
                    },
                    {
                        arabic: "يا مَنيعُ يا سَريعُ يا بَديعُ يا كَبيرُ يا قَديرُ يا خَبيرُ يا مُجيرُ",
                        german: "o Unüberwindlicher, o Zügiger, o Glanzvoller, o Großer, o Mächtiger o Kundiger, o Schutzgewährender.",
                        slideNumber: "69"
                    }
                ],
                [
                    {
                        arabic: "يا حَيّاً قَبْلَ كُلِّ حَيٍّ يا حَيّاً بَعْدَ كُلِّ حَيٍّ يا حَيُّ الَّذي لَيْسَ كَمِثْلِهِ حَيٌّ",
                        german: "o Lebender vor allen Lebewesen, o Lebender nach allen Lebewesen, o Lebender, Dem kein Lebewesen gleicht,",
                        slideNumber: "70"
                    },
                    {
                        arabic: "يا حَيُّ الَّذي لا يُشارِكُهُ حَيٌّ يا حَيُّ الَّذي لا يَحْتاجُ اِلى حَيٍّ يا حَيُّ الَّذي يُميتُ كُلَّ حَيٍّ",
                        german: "o Lebender, Der kein Lebewesen als Partner hat, o Lebender, Der auf kein Lebewesen angewiesen ist, o Lebender, Der alle Lebewesen sterben lässt,",
                        slideNumber: "70"
                    },
                    {
                        arabic: "يا حَيُّ الَّذي يَرْزُقُ كُلَّ حَيٍّ يا حَيّاً لَمْ يَرِثِ الْحَياةَ مِنْ حَيٍّ يا حَيُّ الَّذي يُحْيِي الْمَوْتى يا حَيُّ يا قَيُّومُ لا تَأخُذُهُ سِنَةٌ وَلا نَوْمٌ",
                        german: "o Lebender, Der alle Lebewesen versorgt, o Lebender, Der das Leben von keinem Lebewesen geerbt bekommen hat, o Lebender, Der die Toten wieder zum Leben erweckt, o Lebender, o Beständiger, Ihn überkommt weder Schlummer noch Schlaf.",
                        slideNumber: "70"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ لَهُ ذِكْرٌ لا يُنْسى يا مَنْ لَهُ نُورٌ لا يُطْفَأُ يا مَنْ لَهُ نِعَمٌ لا تُعَدُّ",
                        german: "o Jener, Dessen Erwähnung unvergesslich ist, o Jener, Dessen Licht unauslöschlich ist, o Jener, Dessen Gaben unzählbar sind,",
                        slideNumber: "71"
                    },
                    {
                        arabic: "يا مَنْ لَهُ مُلْكٌ لا يَزُولُ يا مَنْ لَهُ ثَناءٌ لا يُحْصى يا مَنْ لَهُ جَلالٌ لا يُكَيَّفُ",
                        german: "o Jener, Dessen Herrschaft unvergänglich ist, o Jener, Dessen Lob nicht auf zählbar ist, o Jener, Dessen Herrlichkeit unbeschreibbar ist,",
                        slideNumber: "71"
                    },
                    {
                        arabic: "يا مَنْ لَهُ كَمالٌ لا يُدْرَكُ يا مَنْ لَهُ قَضاءٌ لا يُرَدُّ يا مَنْ لَهُ صِفاتٌ لا تُبَدَّلُ يا مَنْ لَهُ نُعُوتٌ لا تُغَيَّرُ",
                        german: "o Jener, Dessen Vollkommenheit unvorstellbar ist, o Jener, Dessen Urteil nicht zurückzuweisen ist, o Jener, Dessen Eigenschaften unersetzbar sind, o Jener, Dessen Attribute unveränderlich sind.",
                        slideNumber: "71"
                    }
                ],
                [
                    {
                        arabic: "يا رَبَّ الْعالَمينَ يا مالِكَ يَوْمِ الدّينِ يا غايَةَ الطّالِبينَ",
                        german: "o Herr der Welten, o Herrscher des Jüngsten Tages, o Endziel der Anstrebenden,",
                        slideNumber: "72"
                    },
                    {
                        arabic: "يا ظَهْرَ اللاّجينَ يا مُدْرِكَ الْهارِبينَ يا مَنْ يُحِبُّ الصّابِرينَ",
                        german: "o Rückhalt der Zufluchtsuchenden, o Erfassender der Fliehenden, o Jener, Der die Geduldigen liebt",
                        slideNumber: "72"
                    },
                    {
                        arabic: "يا مَنْ يُحِبُّ التَّوّابينَ يا مَنْ يُحِبُّ الْمُتَطَهِّرينَ",
                        german: "o Jener, Der die Reumütigen liebt, o Jener, Der die sich Reinigenden liebt,",
                        slideNumber: "72"
                    },
                    {
                        arabic: "يا مَنْ يُحِبُّ الْمحْسِنينَ يا مَنْ هُوَ اَعْلَمُ بِالْمُهْتَدينَ",
                        german: "o Jener, Der die Wohltätigen liebt, o Jener, Der wissender ist über die Rechtgeleiteten.",
                        slideNumber: "72"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا شَفيقُ يا رَفيقُ يا حَفيظُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Erbarmer, o Milder, o Bewahrer,",
                        slideNumber: "73"
                    },
                    {
                        arabic: "يا مُحيطُ يا مُقيتُ يا مُغيثُ يا مُعِزُّ يا مُذِلُّ يا مُبْدِئُ يا مُعيدُ",
                        german: "o Umfassender, o Ernährer, o Rettungsgewährender o Ehrender, o Demütigender, o Urheber, o Wiederherstellender.",
                        slideNumber: "73"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ هُوَ اَحَدٌ بِلا ضِدٍّ يا مَنْ هُوَ فَرْدٌ بِلا نِدٍّ يا مَنْ هُوَ صَمَدٌ بِلا عَيْبٍ",
                        german: "o Jener, Der ein Einziger ohne Gegner ist, o Jener, Der ein Einzelner ohne Rivale ist, o Jener, Der ein Unabhängiger ohne Makel ist,",
                        slideNumber: "74"
                    },
                    {
                        arabic: "يا مَنْ هُوَ وِتْرٌ بِلا كَيْفٍ يا مَنْ هُوَ قاضٍ بِلا حَيْفٍ يا مَنْ هُوَ رَبٌّ بِلا وَزيرٍ",
                        german: "o Jener, Der ein unbeschreibbarer Einmaliger ist, o Jener, Der ein Richter ist ohne Ungerechtigkeit, o Jener, Der ein Herr ohne Berater ist,",
                        slideNumber: "74"
                    },
                    {
                        arabic: "يا مَنْ هُوَ عَزيزٌ بِلا ذُلٍّ يا مَنْ هُوَ غَنِيٌّ بِلا فَقْرٍ",
                        german: "o Jener, Der ein Mächtiger ohne Schwäche ist o Jener, Der reich ist ohne Bedürftigkeit,",
                        slideNumber: "74"
                    },
                    {
                        arabic: "يا مَنْ هُوَ مَلِكٌ بِلا عَزْلٍ يا مَنْ هُوَ مَوْصُوفٌ بِلا شَبيهٍ",
                        german: "o Jener, Der unabsetzbarer Herrscher ist, o Jener, Der ohne einen Ähnlichen beschrieben wird.",
                        slideNumber: "74"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ ذِكْرُهُ شَرَفٌ لِلذّاكِرينَ يا مَنْ شُكْرُهُ فَوْزٌ لِلشّاكِرينَ يا مَنْ حَمْدُهُ عِزٌّ لِلْحامِدينَ",
                        german: "o Jener, Dessen Erwähnung Ehre für die Erwähnenden ist, o Jener, Dessen Dank Triumph für die Dankbaren ist, o Jener, Dessen Lob Stärkung für die Lobpreisenden ist,",
                        slideNumber: "75"
                    },
                    {
                        arabic: "يا مَنْ طاعَتُهُ نَجاةٌ لِلْمُطيعينَ يا مَنْ بابُهُ مَفْتُوحٌ لِلطّالِبينَ يا مَنْ سَبيلُهُ واضِحٌ لِلْمُنيبينَ",
                        german: "o Jener, Dessen Gehorsam Ihm gegenüber für die Gehorsamen Rettung ist, o Jener, Dessen Tür den Wünschenden offen steht, o Jener, Dessen Weg für die Reuenden klar erkennbar ist,",
                        slideNumber: "75"
                    },
                    {
                        arabic: "يا مَنْ آياتُهُ بُرْهانٌ لِلنّاظِرينَ يا مَنْ كِتابُهُ تَذْكِرَةٌ لِلْمُتَّقينَ",
                        german: "o Jener, Dessen Zeichen den Schauenden Beweis sind, o Jener, Dessen Buch eine Erinnerung für die Frommen ist,",
                        slideNumber: "75"
                    },
                    {
                        arabic: "يا مَنْ رِزْقُهُ عُمُومٌ لِلطّائِعينَ وَالْعاصينَ يا مَنْ رَحْمَتُهُ قَريبٌ مِنَ الْمحْسِنينَ",
                        german: "o Jener, Dessen Versorgung für die Gehorsamen und die Ungehorsamen ist, o Jener, Dessen Gnade den Wohltätigen nahe ist.",
                        slideNumber: "75"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ تَبارَكَ اسْمُهُ يا مَنْ تَعالى جَدُّهُ يا مَنْ لا اِلـهَ غَيْرُهُ",
                        german: "o Jener, Dessen Name gesegnet ist, o Jener, Dessen Stellung gehoben ist, o Jener, außer Dem es keine Gottheit gibt,",
                        slideNumber: "76"
                    },
                    {
                        arabic: "يا مَنْ جَلَّ ثَناؤُهُ يا مَنْ تَقَدَّسَتَ اَسْماؤُهُ يا مَنْ يَدُومُ بَقاؤُهُ",
                        german: "o Jener, Dessen Lobpreisung erhaben ist, o Jener, Dessen Namen heilig sind, o Jener, Dessen Beständigkeit ewig währt",
                        slideNumber: "76"
                    },
                    {
                        arabic: "يا مَنِ الْعَظَمَةُ بَهاؤُهُ يا مَنِ الْكِبْرِياءُ رِداؤُهُ يا مَنْ لا تُحْصى الاؤُهُ يا مَنْ لا تُعَدُّ نَعْماؤُه",
                        german: "o Jener, Dessen Größe Sein Glanz ist, o Jener, Dessen Herrlichkeit sein Gewand ist, o Jener, Dessen Wohltaten unermesslich sind, o Jener, Dessen Gaben unzählbar sind.",
                        slideNumber: "76"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُعينُ يا اَمينُ يا مُبينُ يا مَتينُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Helfer, o Vertrauenswürdiger, o Deutlicher, o Starker,",
                        slideNumber: "77"
                    },
                    {
                        arabic: "يا مَكينُ يا رَشيدُ يا حَميدُ يا مَجيدُ يا شَديدُ يا شَهيدُ",
                        german: "o Gewalthabender, o Bedachter, o Lobenswerter, o Ruhmreicher, o Strenger, o Zeuge.",
                        slideNumber: "77"
                    }
                ],
                [
                    {
                        arabic: "يا ذَا الْعَرْشِ الْمجيدِ يا ذَا الْقَوْلِ السَّديدِ يا ذَا الْفِعْلِ الرَّشيدِ",
                        german: "O Dem der ruhmreiche Thron gehört, o Dem die treffende Rede gehört, o Dem die bedachte Handlung gehört,",
                        slideNumber: "78"
                    },
                    {
                        arabic: "يا ذَا الْبَطْشِ الشَّديدِ يا ذَا الْوَعْدِ وَالْوَعيدِ يا مَنْ هُوَ الْوَلِيُّ الْحَميدُ",
                        german: "o Dem die strenge Gewalt gehört, o Dem das Versprechen und die Drohung gehören, o Der lobenswerter Gebieter ist",
                        slideNumber: "78"
                    },
                    {
                        arabic: "يا مَنْ هُوَ فَعّالٌ لِما يُريدُ يا مَنْ هُوَ قَريبٌ غَيْرُ بَعيدٍ",
                        german: "o Der das tut, was Er will, o Naher, Der nicht fern ist,",
                        slideNumber: "78"
                    },
                    {
                        arabic: "يا مَنْ هُوَ عَلى كُلِّ شَيْءٍ شَهيدٌ يا مَنْ هُوَ لَيْسَ بِظَلاّمٍ لِلْعَبيدِ",
                        german: "o Der Zeuge aller Dinge ist, o Der Seinen Dienern gegenüber niemals ungerecht ist.",
                        slideNumber: "78"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ لا شَريكَ لَهُ وَلا وَزيرَ يا مَنْ لا شَبيهَ لَهُ وَلا نَظيرَ يا خالِقَ الشَّمْسِ وَالْقَمَرِ الْمُنيرِ",
                        german: "o Jener, Der weder Partner noch Berater hat, o Jener, Dem nichts gleich oder ähnlich ist, o Schöpfer der Sonne und des leuchtenden Mondes,",
                        slideNumber: "79"
                    },
                    {
                        arabic: "يا مُغْنِيَ الْبائِسِ الْفَقيرِ يا رازِقَ الْطِّفْلِ الصَّغيرِ يا راحِمَ الشَّيْخِ الْكَبيرِ",
                        german: "o Der, Der die unglücklichen Armen reich macht, o Versorger des kleinen Kindes, o Erbarmer des alten Menschen,",
                        slideNumber: "79"
                    },
                    {
                        arabic: "يا جابِرَ الْعَظْمِ الْكَسيرِ يا عِصْمَةَ الْخآئِفِ الْمُسْتَجيرِ",
                        german: "o Einrenkender des gebrochenen Knochens, o Beschützer des ängstlich Hilfesuchenden,",
                        slideNumber: "79"
                    },
                    {
                        arabic: "يا مَنْ هُوَ بِعِبادِهِ خَبيرٌ بَصيرٌ يا مَنْ هُوَ عَلى كُلِّ شَيْءٍ قَديرٌ",
                        german: "o Jener, Der erfahren und allsehend über Seine Diener ist, o Jener, Der zu allem fähig ist.",
                        slideNumber: "79"
                    }
                ],
                [
                    {
                        arabic: "يا ذَا الْجُودِ وَالنِّعَمِ يا ذَا الْفَضْلِ وَالْكَرَمِ يا خالِقَ اللَّوْحِ وَالْقَلَمِ",
                        german: "Oh, Eigner der Großzügigkeit und der Gaben, o Eigner der Gunst und der Großzügigkeit, o Schöpfer der Tafel und des Stifts,",
                        slideNumber: "80"
                    },
                    {
                        arabic: "يا بارِئَ الذَّرِّ وَالنَّسَمِ يا ذَا الْبَأْسِ وَالنِّقَمِ يا مُلْهِمَ الْعَرَبِ وَالْعَجَمِ",
                        german: "o Du Schöpfer der Atome und des beseelten Lebens, o Eigner des Peins und der Vergeltung, o Der Araber wie Nichtaraber inspiriert",
                        slideNumber: "80"
                    },
                    {
                        arabic: "يا كاشِفَ الضُّرِّ وَالألَمِ يا عالِمَ السِّرِّ وَالْهِمَمِ",
                        german: "o Der Schaden und Schmerz beseitigt, o Der Geheimnisse und Absichten kennt,",
                        slideNumber: "80"
                    },
                    {
                        arabic: "يا رَبَّ الْبَيْتِ وَالْحَرَمِ يا مَنْ خَلَقَ الاْشياءَ مِنَ الْعَدَمِ",
                        german: "o Der Herr des Hauses und der Heiligen Stätte ist, o Der die Dinge aus dem Nichts heraus erschaffen hat.",
                        slideNumber: "80"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا فاعِلُ يا جاعِلُ يا قابِلُ",
                        german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Handelnder, o Hervorbringender, o Annehmer,",
                        slideNumber: "81"
                    },
                    {
                        arabic: "يا كامِلُ يا فاصِلُ يا واصِلُ يا عادِلُ يا غالِبُ يا طالِبُ يا واهِبُ",
                        german: "o Vollkommener, o Aburteilender, o Beschenkender, o Gerechter, o Besiegender, o Verlangender, o Spender.",
                        slideNumber: "81"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ اَنْعَمَ بِطَوْلِهِ يا مَنْ اَكْرَمَ بِجُودِهِ يا مَنْ جادَ بِلُطْفِهِ",
                        german: "o Jener, Der mit Seiner Macht Wohltaten erwies, o Jener, Der mit Seiner Güte Großzügigkeit erwies, o Jener, Der mit Seiner Nachsicht Güte erwies,",
                        slideNumber: "82"
                    },
                    {
                        arabic: "يا مَنْ تَعَزَّزَ بِقُدْرَتِهِ يا مَنْ قَدَّرَ بِحِكْمَتِهِ يا مَنْ حَكَمَ بِتَدْبيرِهِ",
                        german: "o Jener, Der mit Seiner Fähigkeit mächtig war, o Jener, Der mit Seiner Weisheit bewertete, o Jener, Der nach Seinen Maßnahmen regierte,",
                        slideNumber: "82"
                    },
                    {
                        arabic: "يا مَنْ دَبَّرَ بِعِلْمِهِ يا مَنْ تَجاوَزَ بِحِلْمِهِ يا مَنْ دَنا في عُلُوِّهِ يا مَنْ عَلا في دُنُوِّهِ",
                        german: "o Jener, Der nach Seinem Wissen Maßnahmen traf, o Jener, Der mit Seinem Langmut absah, o Jener, Der in Seiner Erhabenheit nah war, o Jener, Der mit Seiner Nähe erhaben war.",
                        slideNumber: "82"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ يَخْلُقُ ما يَشاءُ يا مَنْ يَفْعَلُ ما يَشاءُ يا مَنْ يَهْدي مَنْ يَشاءُ",
                        german: "o Jener, Der schafft, was Er will, o Jener, Der tut, was Er will, o Jener, Der zum Rechten leitet, wen er will,",
                        slideNumber: "83"
                    },
                    {
                        arabic: "يا مَنْ يُضِلُّ مَنْ يَشاءُ يا مَنْ يُعَذِّبُ مَنْ يَشاءُ يا مَنْ يَغْفِرُ لِمَنْ يَشآءُ",
                        german: "o Jener, Der irregehen lässt, wen Er will, o Jener, Der bestraft, wen Er will, o Jener, Der verzeiht, wem Er will",
                        slideNumber: "83"
                    },
                    {
                        arabic: "يا مَنْ يُعِزُّ مَنْ يَشاءِ يا مَنْ يُذِلُّ مَنْ يَشاءُ",
                        german: "o Jener, Der stärkt, wen Er will, o Jener, Der demütigt, wen Er will.",
                        slideNumber: "83"
                    },
                    {
                        arabic: "يا مَنْ يُصَوِّرُ فِي الاْرْحامِ ما يَشاءُ يا مَنْ يَخْتَصُّ بِرَحْمَتِهِ مَنْ يَشاءُ",
                        german: "o Jener, Der im Mutterleib gestaltet, was Er will, o Jener, Der Sein Erbarmen schenkt, wem Er will.",
                        slideNumber: "83"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ لَمْ يَتَّخِذْ صاحِبَةً وَلا وَلَداً يا مَنْ جَعَلَ لِكُلِّ شَيْءٍ قَدْراً يا مَنْ لا يُشْرِكُ في حُكْمِهِ اَحَداً",
                        german: "o Jener, Der sich weder Gattin noch Kind nahm, o Jener, Der allen Dingen ein Maß errichtet hat, o Jener, Der an Seiner Herrschaft niemanden teilhaben lässt,",
                        slideNumber: "84"
                    },
                    {
                        arabic: "يا مَنْ جَعَلَ الْمَلائِكَةَ رُسُلاً يا مَنْ جَعَلَ فِي السَّماءِ بُرُوجاً يا مَنْ جَعَلَ الاْرْضَ قَراراً",
                        german: "o Jener, Der die Engel zu Gesandten errichtet hat, o Jener, Der im Himmel Sternbilder errichtet hat, o Jener, Der die Erde zum festen Wohnsitz errichtet hat,",
                        slideNumber: "84"
                    },
                    {
                        arabic: "يا مَنْ خَلَقَ مِنَ الْماءِ بَشَراً يا مَنْ جَعَلَ لِكُلِّ شَيْءٍ اَمَداً",
                        german: "o Jener, Der Menschen aus Wasser erschaffen hat, o Jener, Der für alle Dinge eine Frist errichtet hat,",
                        slideNumber: "84"
                    },
                    {
                        arabic: "يا مَنْ اَحاطَ بِكُلِّ شَيْءٍ عِلْماً يا مَنْ اَحْصى كُلَّ شَيْءٍ عَدَدا",
                        german: "o Jener, Der alles mit Wissen umfasst, o Jener, Der die Anzahl von allem erfasst.",
                        slideNumber: "84"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَوَّلُ يا آخِرُ يا ظاهِرُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Erster, o Letzter, o Offenbarer,",
                        slideNumber: "85"
                    },
                    {
                        arabic: "يا باطِنُ يا بَرُّ يا حَقُّ يا فَرْدُ يا وِتْرُ يا صَمَدُ يا سَرْمَدُ",
                        german: "o Unsichtbarer, o Gütiger, o Rechtsschaffner, o Einziger, o Einzelner, o Unabhängiger, o Ewiger.",
                        slideNumber: "85"
                    }
                ],
                [
                    {
                        arabic: "يا خَيْرَ مَعْرُوفٍ عُرِفَ يا اَفْضَلَ مَعْبُودٍ عُبِدَ يا اَجَلَّ مَشْكُورٍ شُكِرَ",
                        german: "o wohltätigster Bekannter, Der bekannt wurde, o gütigster Angebeteter, Der angebetet wurde, o majestätischster Gedankter, Dem gedankt wurde,",
                        slideNumber: "86"
                    },
                    {
                        arabic: "يا اَعَزَّ مَذْكُورٍ ذُكِرَ يا اَعْلى مَحْمُودٍ حُمِدَ يا اَقْدَمَ مَوْجُودٍ طُلِبَ",
                        german: "o mächtigster Erwähnter, Der erwähnt wurde, o höchster Gelobter, Der gelobt wurde, o ältester Existierender, Der angestrebt wurde,",
                        slideNumber: "86"
                    },
                    {
                        arabic: "يا اَرْفَعَ مَوْصُوفٍ وُصِفَ يا اَكْبَرَ مَقْصُودٍ قُصِدَ يا اَكْرَمَ مَسْؤولٍ سُئِلَ يا اَشْرَفَ مَحْبُوبٍ عُلِمَ",
                        german: "o angesehenster Beschriebener, Der beschrieben wurde, o größter Erstrebter, Der erstrebt wurde, o großzügigster Gefragter, Der gefragt wurde, o ruhmreichster Geliebter, Der gekannt worden ist.",
                        slideNumber: "86"
                    }
                ],
                [
                    {
                        arabic: "يا حَبيبَ الْباكينَ يا سَيِّدَ الْمُتَوَكِّلينَ يا هادِيَ الْمُضِلّينَ",
                        german: "o Geliebter der Weinenden, o Herr der Vertrauenden, o Rechtleitender der Fehlgeleiteten,",
                        slideNumber: "87"
                    },
                    {
                        arabic: "يا وَلِيَّ الْمُؤْمِنينَ يا اَنيسَ الذّاكِرينَ يا مَفْزَعَ الْمَلْهُوفينَ",
                        german: "o Gebieter der Gläubigen, o Vertrauter der Erwähnenden, o Zuflucht der Hilfesuchenden,",
                        slideNumber: "87"
                    },
                    {
                        arabic: "يا مُنْجِيَ الصّادِقينَ يا اَقْدَرَ الْقادِرينَ يا اَعْلَمَ الْعالِمينَ يا اِلـهَ الْخَلْقِ اَجْمَعينَ",
                        german: "o Retter der Wahrhaftigen, o Mächtigster der Mächtigen, o Wissendster der Wissenden, o Gott der Geschöpfe allesamt.",
                        slideNumber: "87"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ عَلا فَقَهَرَ يا مَنْ مَلَكَ فَقَدَرَ يا مَنْ بَطَنَ فَخَبَرَ",
                        german: "o Jener, Der höher ist und überwältigt hat, o Jener, Der herrscht und mächtig ist, o Jener, Der unsichtbar und erfahren ist,",
                        slideNumber: "88"
                    },
                    {
                        arabic: "يا مَنْ عُبِدَ فَشَكَرَ يا مَنْ عُصِيَ فَغَفَرَ يا مَنْ لا تَحْويهِ الْفِكَرُ",
                        german: "o Jener, Der angebetet wird und sich bedankt, o Jener, Dem Ungehorsam gezeigt wird und vergibt, o Jener, Der in den Gedanken nicht erfassbar ist,",
                        slideNumber: "88"
                    },
                    {
                        arabic: "يا مَنْ لا يُدْرِكُهُ بَصَرٌ يا مَنْ لا يَخْفى عَلَيْهِ اَثَرٌ",
                        german: "o Jener, Der für das Sehvermögen nicht erreichbar ist, o Jener, Dem keine Spur verborgen bleibt,",
                        slideNumber: "88"
                    },
                    {
                        arabic: "يا رازِقَ الْبَشَرِ يا مُقَدِّرَ كُلِّ قَدَرٍ",
                        german: "o Jener, Der die Menschen versorgt, o Jener, Der jedes Maß bemisst.",
                        slideNumber: "88"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا حافِظُ يا بارِئُ يا ذارِئُ يا باذِخُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Bewahrer, o Lebenschenkender, o Urheber, o Großzügiger",
                        slideNumber: "89"
                    },
                    {
                        arabic: "يا فارِجُ يا فاتِحُ يا كاشِفُ يا ضامِنُ يا امِرُ يا ناهي",
                        german: "o Erlöser, o Eröffnender, o Enthüllender, o Bürge, o Befehlender, o Verwehrender.",
                        slideNumber: "89"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ لا يَعْلَمُ الْغَيْبَ إلاّ هُوَ يا مَنْ لا يَصْرِفُ السُّوءَ إلاّ هُوَ يا مَنْ لا يَخْلُقُ الْخَلْقَ إلاّ هُوَ",
                        german: "o Jener, außer Dem niemand das Verborgene weiß, o Jener, außer Dem niemand das Schlechte abwendet, o Jener, außer Dem niemand die Schöpfung erschafft,",
                        slideNumber: "90"
                    },
                    {
                        arabic: "يا مَنْ لا يَغْفِرُ الذَّنْبَ إلاّ هُوَ يا مَنْ لا يُتِمُّ النِّعْمَةَ إلاّ هُوَ يا مَنْ لا يُقَلِّبُ الْقُلُوبَ إلاّ هُوَ",
                        german: "o Jener, außer Dem niemand die Sünden verzeiht, o Jener, außer Dem niemand die Wohltaten vollendet, o Jener, außer Dem niemand die Herzen prüft,",
                        slideNumber: "90"
                    },
                    {
                        arabic: "يا مَنْ لا يُدَبِّرُ الاْمْرَ إلاّ هُوَ يا مَنْ لا يُنَزِّلُ الْغَيْثَ إلاّ هُوَ",
                        german: "o Jener, außer dem niemand die Dinge steuert, o Jener, außer Dem niemand den Regen herabsendet,",
                        slideNumber: "90"
                    },
                    {
                        arabic: "يا مَنْ لا يَبْسُطُ الرِّزْقَ إلاّ هُوَ يا مَنْ لا يُحْيِي الْمَوْتى إلاّ هُوَ",
                        german: "o Jener, außer Dem niemand die Versorgung verteilt, o Jener, außer Dem niemand die Toten wieder zum Leben erweckt.",
                        slideNumber: "90"
                    }
                ],
                [
                    {
                        arabic: "يا مُعينَ الْضُعَفاءِ يا صاحِبَ الْغُرَباءِ يا ناصِرَ الاْوْلِياءِ",
                        german: "o Unterstützer der Schwachen, o Gefährte der Fremden, o Beistand der Gefolge,",
                        slideNumber: "91"
                    },
                    {
                        arabic: "يا قاهِرَ الاْعْداءِ يا رافِعَ السَّماءِ يا اَنيسَ الاْصْفِياءِ",
                        german: "o Du Bezwinger der Feinde, o Aufrichter der Himmel, o Gefährte der Auserwählten,",
                        slideNumber: "91"
                    },
                    {
                        arabic: "يا حَبيبَ الاْتْقِياءِ يا كَنْزَ الْفُقَراءِ يا اِلـهَ الاْغْنِياءِ يا اَكْرَمَ الْكُرَماءِ",
                        german: "o Geliebter der Frommen, o Schatz der Armen, o Gott der Reichen, o Großzügigster der Großzügigen.",
                        slideNumber: "91"
                    }
                ],
                [
                    {
                        arabic: "يا كافِياً مِنْ كُلِّ شَيْءٍ يا قائِماً عَلى كُلِّ شَيْءٍ يا مَنْ لا يُشْبِهُهُ شَيْءٌ",
                        german: "o Du Genügender aller Dinge, o Du Bewahrer aller Dinge, o Jener, dem nichts ähnelt,",
                        slideNumber: "92"
                    },
                    {
                        arabic: "يا مَنْ لا يَزيدُ في مُلْكِهِ شَيْءٌ يا مَنْ لا يَخْفى عَلَيْهِ شَيْءٌ يا مَنْ لا يَنْقُصُ مِنْ خَزائِنِهِ شَيْءٌ",
                        german: "o Jener, Dessen Königreich nichts vermehrt, o Jener, Dem nichts verborgen bleibt, o Jener, von Dessen Schätze nichts vermindern kann,",
                        slideNumber: "92"
                    },
                    {
                        arabic: "يا مَنْ لَيْسَ كَمِثْلِهِ شَيْءٌ يا مَنْ لا يَعْزُبُ عَنْ عِلْمِهِ شَيءٌ",
                        german: "o Jener, Dem nichts gleicht, o Jener, Dessen Wissen nichts entgeht,",
                        slideNumber: "92"
                    },
                    {
                        arabic: "يا مَنْ هُوَ خَبيرٌ بِكُلِّ شَيْءٍ يا مَنْ وَسِعَتْ رَحْمَتُهُ كُلَّ شَيْءٍ",
                        german: "o Jener, Der über alles erfahren ist, o Jener, Dessen Gnade alles umschlossen hat.",
                        slideNumber: "92"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْئَلُكَ بِاسْمِكَ يا مُكْرِمُ يا مُطْعِمُ يا مُنْعِمُ يا مُعْطي",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Großzügiger, o Speisender, o Wohltätiger, o Gebender,",
                        slideNumber: "93"
                    },
                    {
                        arabic: "يا مُغْني يا مُقْني يا مُفْني يا مُحْيي يا مُرْضي يا مُنْجي",
                        german: "o Bereicherer, o Besitzverleiher, o Vernichter, o Lebensschenker, o Zufriedenstellender, o Retter.",
                        slideNumber: "93"
                    }
                ],
                [
                    {
                        arabic: "يا اَوَّلَ كُلِّ شَيْءٍ وَآخِرَهُ يا اِلـهَ كُلِّ شَيْءٍ وَمَليكَهُ يا رَبَّ كُلِّ شَيْءٍ وَصانِعَهُ",
                        german: "o Anfang aller Dinge und deren Ende, o Gott aller Dinge und deren Herrscher, o Herr aller Dinge und deren Gestalter,",
                        slideNumber: "94"
                    },
                    {
                        arabic: "يا بارئَ كُلِّ شَيْءٍ وَخالِقَهُ يا قابِضَ كُلِّ شَيْءٍ وَباسِطَهُ يا مُبْدِئَ كُلِّ شَيْءٍ وَمُعيدَهُ",
                        german: "o Urheber aller Dinge und deren Schöpfer, o Begrenzer aller Dinge und deren Ausbreiter, o Ursprunggeber aller Dinge und deren Wiederbringer,",
                        slideNumber: "94"
                    },
                    {
                        arabic: "يا مُنْشِئَ كُلِّ شَيْءٍ وَمُقَدِّرَهُ يا مُكَوِّنَ كُلِّ شَيْءٍ وَمُحَوِّلَهُ",
                        german: "o Erschaffer aller Dinge und deren Bemesser, o Former aller Dinge und deren Umwandler,",
                        slideNumber: "94"
                    },
                    {
                        arabic: "يا مُحْيِيَ كُلِّ شَيْءٍ وَمُميتَهُ يا خالِقَ كُلِّ شَيْءٍ وَوارِثَهُ",
                        german: "o Lebensspender aller Dinge und deren Lebensnehmer, o Schöpfer aller Dinge und deren Erbe.",
                        slideNumber: "94"
                    }
                ],
                [
                    {
                        arabic: "يا خَيْرَ ذاكِرٍ وَمَذْكُورٍ يا خَيْرَ شاكِرٍ وَمَشْكُورٍ يا خَيْرَ حامِدٍ وَمَحْمُودٍ",
                        german: "o wohltätigster Erwähnender und Erwähnter, o wohltätigster Dankender und Bedankter, o wohltätigster Lobender und Gelobter,",
                        slideNumber: "95"
                    },
                    {
                        arabic: "يا خَيْرَ شاهِدٍ وَمَشْهُودٍ يا خَيْرَ داعٍ وَمَدْعُوٍّ يا خَيْرَ مُجيبٍ وَمُجابٍ",
                        german: "o wohltätigster Zeuge und Bezeugter, o wohltätigster Einladender und Geladener, o wohltätigster Erfüllender und Dem entsprochen wird,",
                        slideNumber: "95"
                    },
                    {
                        arabic: "يا خَيْرَ مُؤنِسٍ وَاَنيسٍ يا خَيْرَ صاحِبٍ وَجَليسٍ",
                        german: "o wohltätigster Gefährtenleitender und Gefährte, o wohltätigster Begleiter und Gesellschaft Leistender,",
                        slideNumber: "95"
                    },
                    {
                        arabic: "يا خَيْرَ مَقْصُودٍ وَمَطْلُوبٍ يا خَيْرَ حَبيبٍ وَمَحْبُوبٍ",
                        german: "o wohltätigstes Ziel und Erwünschter, o wohltätigster Liebender und Geliebter.",
                        slideNumber: "95"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ هُوَ لِمَنْ دَعاهُ مُجيبٌ يا مَنْ هُوَ لِمَنْ اَطاعَهُ حَبيبٌ",
                        german: "o Jener, Der jenen, die Ihn rufen, antwortet, o Jener, Der von jenen, die Ihm gehorchen, geliebt wird,",
                        slideNumber: "96"
                    },
                    {
                        arabic: "يا مَنْ هُوَ اِلى مَنْ اَحَبَّهُ قَريبٌ يا مَنْ هُوَ بِمَنِ اسْتَحْفَظَهُ رَقيبٌ",
                        german: "o Jener, Der jenen, die Ihn lieben, nahe ist, o Jener, Der jene, die Ihn um Behütung bitten, bewacht,",
                        slideNumber: "96"
                    },
                    {
                        arabic: "يا مَنْ هُوَ بِمَنْ رَجاهُ كَريمٌ يا مَنْ هُوَ بِمَنْ عَصاهُ حَليمٌ",
                        german: "o Jener, Der gegenüber jenen, die auf Ihn hoffen, großzügig ist, o Jener, Der nachsichtig mit jenen ist, die ihm gegenüber ungehorsam sind,",
                        slideNumber: "96"
                    },
                    {
                        arabic: "يا مَنْ هُوَ في عَظَمَتِهِ رَحيمٌ يا مَنْ هُوَ في حِكْمَتِهِ عَظيمٌ",
                        german: "o Jener, Der in Seiner Größe barmherzig ist, o Jener, Der in Seiner Weisheit groß ist,",
                        slideNumber: "96"
                    },
                    {
                        arabic: "يا مَنْ هُوَ في اِحْسانِهِ قَديمٌ يا مَنْ هُوَ بِمَنْ اَرادَهُ عَليمٌ",
                        german: "o Jener, Der in Seiner Güte ohne Anfang ist, o Jener, Der um jene weiß, die Ihn erstreben.",
                        slideNumber: "96"
                    }
                ],
                [
                    {
                        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُسَبِّبُ يا مُرَغِّبُ يا مُقَلِّبُ",
                        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Verursacher, o Erweckender von Begehren, o Prüfer,",
                        slideNumber: "97"
                    },
                    {
                        arabic: "يا مُعَقِّبُ يا مُرَتِّبُ يا مُخَوِّفُ يا مُحَذِّرُ يا مُذَكِّرُ يا مُسَخِّرُ يا مُغَيِّرُ",
                        german: "o Verfolger, o Ordner, o Angsteinflößender, o Warnender, o Erinnernder, o Unterwerfer, o Verändernder.",
                        slideNumber: "97"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ عِلْمُهُ سابِقٌ يا مَنْ وَعْدُهُ صادِقٌ يا مَنْ لُطْفُهُ ظاهِرٌ",
                        german: "o Jener, Dessen Wissen schon früher existiert, o Jener, Dessen Versprechen aufrichtig ist, o Jener, Dessen Nachsicht offensichtlich ist,",
                        slideNumber: "98"
                    },
                    {
                        arabic: "يا مَنْ اَمْرُهُ غالِبٌ يا مَنْ كِتابُهُ مُحْكَمٌ يا مَنْ قَضاؤُهُ كأئِنٌ",
                        german: "o Jener, Dessen Befehl siegreich ist, o Jener, Dessen Buch unmissverständlich ist, o Jener, Dessen Richtsspruch existiert",
                        slideNumber: "98"
                    },
                    {
                        arabic: "يا مَنْ قُرآنُهُ مَجيدٌ يا مَنْ مُلْكُهُ قَديمٌ",
                        german: "o Jener, Dessen Qur´an ruhmreich ist, o Jener, Dessen Herrschaft ohne Anfang ist,",
                        slideNumber: "98"
                    },
                    {
                        arabic: "يا مَنْ فَضْلُهُ عَميمٌ يا مَنْ عَرْشُهُ عَظيمٌ",
                        german: "o Jener, Dessen Huld allgemein ist, o Jener, Dessen Thron herrlich ist.",
                        slideNumber: "98"
                    }
                ],
                [
                    {
                        arabic: "يا مَنْ لا يَشْغَلُهُ سَمْعٌ عَنْ سَمْعٍ يا مَنْ لا يَمْنَعُهُ فِعْلٌ عَنْ فِعْلٍ",
                        german: "o Jener, Den das Hören nicht vom Hören ablenkt, o Jener, Dem keine Tat am Handeln hindert,",
                        slideNumber: "99"
                    },
                    {
                        arabic: "يا مَنْ لا يُلْهيهِ قَوْلٌ عَنْ قَوْلٍ يا مَنْ لا يُغَلِّطُهُ سُؤالٌ عَنْ سُؤالٍ",
                        german: "o Jener, Den das Aussprechen nicht vom Aussprechen abhält, o Jener, Der durch Fragen nicht vom Fragen abgebracht wird",
                        slideNumber: "99"
                    },
                    {
                        arabic: "يا مَنْ لا يَحْجُبُهُ شَيْءٌ عَنْ شَيْءٍ يا مَنْ لا يُبْرِمُهُ اِلْحاحُ الْمُلِحّينَ",
                        german: "o Jener, Der nicht von etwas abgeschirmt wird durch etwas anderes, o Jener, Der durch das Drängen der Beharrlichen nicht überdrüssig wird,",
                        slideNumber: "99"
                    },
                    {
                        arabic: "يا مَنْ هُوَ غايَةُ مُرادِ الْمُريدينَ",
                        german: "o Jener, Der der Beweggrund der Begehrenden ist",
                        slideNumber: "99"
                    },
                    {
                        arabic: "يا مَنْ هُوَ مُنْتَهى هِمَمِ الْعارِفينَ يا مَنْ هُوَ مُنْتَهى طَلَبِ الطّالِبينَ",
                        german: "o Jener, Der das Endziel des Willens der Wissenden ist, o Jener, Der das Endziel des Strebens der Strebenden ist,",
                        slideNumber: "99"
                    },
                    {
                        arabic: "يا مَنْ لا يَخْفى عَلَيْهِ ذَرَّةٌ فِي الْعالَمينَ",
                        german: "o Jener, Dem kein Atom in den Welten verborgen ist.",
                        slideNumber: "99"
                    }
                ],
                [
                    {
                        arabic: "يا حَليماً لا يَعْجَلُ يا جَواداً لا يَبْخَلُ يا صادِقاً لا يُخْلِفُ",
                        german: "o Nachsichtiger, Der es nicht eilig hat, o Großzügiger, Der nicht geizig ist, o Wahrhaftiger, Der sein Versprechen nicht bricht,",
                        slideNumber: "100"
                    },
                    {
                        arabic: "يا وَهّاباً لا يَمَلُّ يا قاهِراً لا يُغْلَبُ يا عَظيماً لا يُوصَفُ",
                        german: "o Schenker, Der nicht verdrossen wird, o Bezwinger, Der nicht besiegt wird, o Gewaltiger, Der nicht beschreibbar ist,",
                        slideNumber: "100"
                    },
                    {
                        arabic: "يا عَدْلاً لا يَحيفُ يا غَنِيّاً لا يَفْتَقِرُ يا كَبيراً لا يَصْغُرُ يا حافِظاً لا يَغْفَلُ.",
                        german: "o Gerechter, Der nicht ungerecht wird, o Reicher, Der nicht verarmt, o Großer, Der nicht klein wird, o Behüter, Der nicht vernachlässigt.",
                        slideNumber: "100"
                    }
                ]
            ]
        }

        if ( !duaChapter ) {
            const errorResponse: any = {
                status: 0,
                message: 'Could not find a Dua Chapter with the provided id.',
                data: undefined,
            };
            return response.status(200).send(errorResponse);
        }

        let hasBasmala = false;

        if ( duaChapter.verses.at(0).at(0).arabic === "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ" ) {
            hasBasmala = true;
        }

        const OUTFILE = path.join(__dirname, '../../..', 'public/generated/Dua/pdf/') + duaChapterParam.folderName + duaChapter.name;
        await this.createPDFPuppeteerJawschan(OUTFILE, {
            hasBasmala,
            title: duaChapter.name,
            slides: duaChapter.verses,
        });
        
        const successResponse: any = {
            status: 1,
            message: 'Found Dua Chapter.',
            data: instanceToPlain({ url: OUTFILE + '.pdf', duaChapter }),
        };
        return response.status(200).send(successResponse);
    }

    @Post('/chapters/abi-hamza/pdf')
    public async generateDuaAbiHamzaPDF(
        @Body() duaChapterParam: DuaChapterToPDFRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(`Looking for duaChapter { id: ${2} }`)
        const duaChapter = await this.duaService.findOneChapter({
            where: {
                id: 2,
            },
            relations: ['verses'],
        });

        if ( !duaChapter ) {
            const errorResponse: any = {
                status: 0,
                message: 'Could not find a Dua Chapter with the provided id.',
                data: undefined,
            };
            return response.status(200).send(errorResponse);
        }

        let hasBasmala = false;

        if ( duaChapter.verses.at(0).arabic === "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ" ) {
            hasBasmala = true;
        }

        const outputParams = {
            name: duaChapter.name,
            path: path.join(__dirname, '../../..', 'public/generated/Dua/pdf/') + duaChapterParam.folderName + duaChapter.name,
        };

        await this.createPDFPuppeteerAbiHamza(outputParams, {
            hasBasmala,
            title: duaChapter.name,
            slides: duaChapter.verses,
        });
        
        const successResponse: any = {
            status: 1,
            message: 'Found Dua Chapter.',
            data: instanceToPlain({ url: outputParams.path + '.pdf', duaChapter }),
        };
        return response.status(200).send(successResponse);
    }

    @Post('/chapters/:id/pdf')
    public async generateFullChapterPDF(
        @Param('id') id: string,
        @Body() duaChapterParam: DuaChapterToPDFRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(`Looking for duaChapter { id: ${id} }`)
        const duaChapter = await this.duaService.findOneChapter({
            where: {
                id: id,
            },
            relations: ['verses'],
        });

        if ( !duaChapter ) {
            const errorResponse: any = {
                status: 0,
                message: 'Could not find a Dua Chapter with the provided id.',
                data: undefined,
            };
            return response.status(200).send(errorResponse);
        }

        let hasBasmala = false;

        if ( duaChapter.verses.at(0).arabic === "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ" ) {
            hasBasmala = true;
        }

        const outputParams = {
            name: duaChapter.name,
            path: path.join(__dirname, '../../..', 'public/generated/Dua/pdf/') + duaChapterParam.folderName + duaChapter.name,
        }
        await this.createPDFPuppeteer(outputParams, {
            hasBasmala,
            title: duaChapter.name,
            slides: duaChapter.verses,
            chapterId: duaChapter.id,
            baseUrl: env.baseUrl,
        });
        
        const successResponse: any = {
            status: 1,
            message: 'Found Dua Chapter.',
            data: instanceToPlain({ url: outputParams.path + '.pdf', duaChapter }),
        };
        return response.status(200).send(successResponse);
    }

    @Post('/books')
    public async createBook(
        @Body() bookParams: DuaChapterToPDFRequest & { name: string, content: number[] },
        @Res() response: any
    ): Promise<any> {
        let hasBasmala = false;

        const outputParams = {
            name: bookParams.name ?? 'book',
            path: path.join(__dirname, '../../..', 'public/generated/Dua/pdf/') + bookParams.folderName + bookParams.name,
        }

        await this.renderBook(outputParams, {
            hasBasmala,
            title: '',
            slides: [],
            chapterId: 0,
            baseUrl: env.baseUrl,
        });
        
        const successResponse: any = {
            status: 1,
            message: 'Found Dua Chapter.',
            data: instanceToPlain({ url: outputParams.path + '.pdf' }),
        };
        return response.status(200).send(successResponse);
    }

    private async createPDFPuppeteerJawschan(output: string, content: any): Promise<any> {
        const assets = {
            background: {
                src: ('../files/Templates/2023/dua-jawschan-kabeer/Dua-Jawshan-Hintergrund.jpg'),
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

        let i = 0;

        for ( const slide of content.slides ) {
            if ( i >= 4 ) {
                return;
            }

            await ejs.renderFile(path.join(__dirname, '../../..', 'views/Dua/2023/dua-jawschan-kabeer.ejs'), {assets, content: {
                title: content.title,
                slide,
            }}, async (err: any, data) => {
                const page = await browser.newPage();
    
                const file = path.join(__dirname, '../../..', 'public') + '/pages/slide.html';
                console.log('file://' + file);
                
                await writeFile(file, data);
    
                await page.goto('file://' + file, {timeout: 0});
                // await page.setContent(data);
    
                console.log('opened slideshow');
        
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
                    path: `${output}-${slide.id}.pdf`,
                    printBackground: true,
                });
        
                console.log("done");
                await browser.close();
                i++;
            });
        }
    
    }

    private async createPDFPuppeteerAbiHamza(output: {
            name: string
            path: string,
        }, content: any): Promise<any> {
        const assets = {
            background: {
                src: ('../../files/Templates/2023/allgemein/allgemein.jpg'),
                width: 1920,
                height: 1080,
            },
            ribbon: {
                src: ('../../files/Templates/1/dark/ribbon.png'),
                width: 1921,
                height: 130,
            },
            lantern: {
                src: ('../../files/Templates/1/dark/lantern.png'),
                width: 170,
                height: 438,
            },
            image: {
                src: ('../../files/Templates/1/dark/image.png'),
                width: 502,
                height: 559,
            },
        };

        let browser: Browser;

        try {
            browser = await puppeteer.launch({
                headless: true,
                defaultViewport: {
                    width: 1920,
                    height: 1080,
                },
                args: ['--allow-file-access-from-files', '--enable-local-file-accesses']
            });
    
            for ( let i = 0; i < content.slides.length; i++ ) {
                if ( i >= 4 ) {
                    return;
                }
    
                const slide = content.slides[i];
    
                await ejs.renderFile(path.join(__dirname, '../../..', 'views/Dua/2023/dua-abi-hamza-layale-qader.ejs'), {assets, content: {
                    title: content.title,
                    slide,
                }}, async (err: any, data) => {
                    if ( err ) {
                        console.log(err);
                        return;
                    }
                    
                    try {
                        const page = await browser.newPage();
            
                        const file = path.join(__dirname, '../../..', 'public') + `/pages/abi-hamza/${slide.number}.html`;
                        console.log('file://' + file);
                        
                        await writeFile(file, data);
            
                        await page.goto('file://' + file, {timeout: 0});
                        // await page.setContent(data);
            
                        console.log('opened slideshow');
                
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
                            path: `${output.path}-${slide.number}.pdf`,
                            printBackground: true,
                        });
                        
                        console.log("done");
                    } catch (innerErr) {
                        console.log(innerErr);
                    }
            
                    i++;
                });
            }
        } catch (e) {
            console.log(e);
        } finally {
            // if ( browser ) {
            //     await browser.close();
            // }
        }

    
    }

    private async createPDFPuppeteer(output: { name: string, path: string }, content: any): Promise<any> {
        const assets = {
            background: {
                src: ('../files/Templates/2023/ziyarat-aschura/ziyarat-aschura.jpg'),
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
            userDataDir: path.join(__dirname, '../../..', `userDataDir/Dua/2024/${output.name}`),
            args: ['--allow-file-access-from-files', '--enable-local-file-accesses']
        });
    
        await ejs.renderFile(path.join(__dirname, '../../..', 'views/Dua/2024/dua-kumayl.ejs'), {assets, content}, async (err: any, data) => {
            const page = await browser.newPage();

            // const file = path.join(__dirname, '../../..', 'public') + `/pages/${output}.html`;
            const file = path.join(__dirname, '../../..', 'public') + `/pages/${output.name}.html`;
            console.log('file://' + file);
            
            await writeFile(file, data);
            console.log('finished writing slides to file');

            await page.goto('file://' + file, {
                timeout: 0,
            });
            
            // await page.setContent(data);

            console.log('page opened');
    
            await sleep(5000);
    
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
                path: output.path + '.pdf',
                printBackground: true,
            });
    
            console.log("done");

            await sleep(20000);
            await browser.close();
        });
    
    }

    private async renderBook(output: { name: string, path: string }, content: any): Promise<any> {
        const pageSetup = {
            unit: 'mm',
            width: 105,
            height: 148,
            margin: {
                top: 3,
                right: 3,
                bottom: 3,
                left: 3,
            },
            gutter: 20,
            padding: 5,
        };

        const assets = {
            background: {
                // src: ('../files/Templates/2023/2023-12-ziyara-buch-iran/2023-12-ziyara-buch-iran.jpg'),
                src: (''),
                width: 105,
                height: 148,
            },
            logo: {
                src: ('http://localhost:5002/img/1x/Logo.png'),
                width: 250,
                height: 225,
            }
        };

        const browser = await puppeteer.launch({
            headless: true,
            userDataDir: path.join(__dirname, '../../..', `userDataDir/Dua/2023/${output.name}`),
            args: ['--allow-file-access-from-files', '--enable-local-file-accesses']
        });
    
        await ejs.renderFile(path.join(__dirname, '../../..', 'views/Dua/2023/2023-12-ziyara-buch-iran-2.ejs'), {pageSetup, assets, content}, async (err: any, data) => {
            const page = await browser.newPage();

            // const file = path.join(__dirname, '../../..', 'public') + `/pages/${output}.html`;
            const file = path.join(__dirname, '../../..', 'public') + `/pages/${output.name}.html`;
            console.log('file://' + file);
            
            await writeFile(file, data);
            console.log('finished writing slides to file');

            await page.goto('file://' + file, {
                timeout: 0,
            });

            console.log('page opened');
    
            await sleep(2000);
            
            await page.pdf({
                omitBackground: true,
                width: (pageSetup.width + pageSetup.margin.left + pageSetup.margin.right) + pageSetup.unit,
                height: (pageSetup.height + pageSetup.margin.top + pageSetup.margin.bottom) + pageSetup.unit,
                margin: {
                    top: pageSetup.margin.top + pageSetup.unit,
                    right: 0,
                    bottom: 0,
                    left: pageSetup.margin.left + pageSetup.unit,
                },
                // width: (pageSetup.width + pageSetup.margin.left + pageSetup.margin.right) + pageSetup.unit,
                // height: (pageSetup.height + pageSetup.margin.top + pageSetup.margin.bottom) + pageSetup.unit,
                // margin: {
                //     top: pageSetup.margin.top + pageSetup.unit,
                //     right: pageSetup.margin.right + pageSetup.unit,
                //     bottom: pageSetup.margin.bottom + pageSetup.unit,
                //     left: pageSetup.margin.left + pageSetup.unit,
                // },
                path: output.path + '.pdf',
                printBackground: true,
            });
    
            console.log("done");

            // await sleep(25000);
            await browser.close();
        });
    
    }

    @Post('/print')
    public async printBookToPDF(
        @Body() output: { name: string, path: string },
        @Res() response: Response,
    ): Promise<any> {
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: {
                width: 1240,
                height: 1748,
            },
            userDataDir: path.join(__dirname, '../../..', `userDataDir/Dua/2023/${output.name}`),
            args: ['--allow-file-access-from-files', '--enable-local-file-accesses']
        });
    
        const page = await browser.newPage();

        const file = path.join(__dirname, '../../..', 'public') + `/pages/${output.name}.html`;
        console.log('file://' + file);
        
        await page.goto('file://' + file, {
            timeout: 0,
        });

        console.log('page opened');

        await page.pdf({
            omitBackground: true,
            width: 1240,
            height: 1748,
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            },
            path: output.path + '.pdf',
            printBackground: true,
        });

        console.log("done");

        await browser.close();
        response.status(201).send();
    }
}

/*

// import dua from word file

let text = `عربي
Arabi (Transliteration)
Arabisch (Deutsche Übersetzung)`;

const lines = text.split("\n\n");

const translations = [];

let i = 1;
for (const line of lines) {
    const translation = line.split("\n");
    translations.push({
        "arabic": translation[0],
        "transliteration": translation[1],
        "german": translation[2],
        "slide": i++,
    });
}

*/


/*

let dua = [
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَللهُ يا رَحْمنُ يا رَحيمُ يا كَريمُ يا مُقيمُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Allah, o Gnädiger, o Erbarmer, o Großzügiger,",
        slideNumber: "1"
    },
    {
        arabic: "يا عَظيمُ يا قَديمُ يا عَليمُ يا حَليمُ يا حَكيمُ",
        german: "o Aufrechterhalter, o Herrlicher, o Anfangsloser, o Wissender, o Sanftmütiger, o Weiser.",
        slideNumber: "1"
    },
    {
        arabic: "يا سَيِّدَ السّاداتِ يا مُجيبَ الدَّعَواتِ يا رافِعَ الدَّرَجاتِ",
        german: "o Fürst der Fürsten, o Erhörender der Gebete, o Ehrhöher des Ranges,",
        slideNumber: "2"
    },
    {
        arabic: "يا وَلِيَّ الْحَسَناتِ يا غافِرَ الْخَطيئاتِ يا مُعْطِيَ الْمَسْأَلاتِ",
        german: "o Statthalter der guten Dinge, o Vergebender der Fehler, o Erfüllender der Wünsche,",
        slideNumber: "2"
    },
    {
        arabic: "يا قابِلَ التَّوْباتِ يا سامِعَ الأصْواتِ يا عالِمَ الْخَفِيّاتِ يا دافِعَ الْبَلِيَّاتِ",
        german: "o Annehmer der Reue, o Hörender der Stimmen, o Wissender des Verborgenen, o Fernhalter des Unheils",
        slideNumber: "2"
    },
    {
        arabic: "يا خَيْرَ الْغافِرينَ يا خَيْرَ الْفاتِحينَ يا خَيْرَ النّاصِرينَ يا خَيْرَ الْحاكِمينَ يا خَيْرَ الرّازِقينَ",
        german: "o Segenreichster der Vergeber, o Segenreichster der Eroberer, o Segenreichster der Helfer, o Segenreichster der Regierenden, o Segenreichster der Ernährer,",
        slideNumber: "3"
    },
    {
        arabic: "يا خَيْرَ الْوارِثينَ يا خَيْرَ الْحامِدينَ يا خَيْرَ الذّاكِرينَ يا خَيْرَ الْمُنْزِلينَ يا خَيْرَ الْمحْسِنينَ",
        german: "o Segenreichster der Erben, o Segenreichster der Lobenden, o Segenreichster der Preisenden, o Segenreichster der Herabsendenden, o Segenreichster der Wohltäter.",
        slideNumber: "3"
    },
    {
        arabic: "يا مَنْ لَهُ الْعِزَّةُ وَالْجَمالُ يا مَنْ لَهُ الْقُدْرَةُ وَالْكَمالُ",
        german: "o Jener, Der die Erhabenheit und die Schönheit ist, o Jener, Der die Allmacht und die Vollkommenheit ist,",
        slideNumber: "4"
    },
    {
        arabic: "يا مَنْ لَهُ الْمُلْكُ وَالْجَلالُ يا مَنْ هُوَ الْكَبيرُ الْمُتَعالُ",
        german: "o Jener, Der die Herrschaft und die Pracht ist, o Jener, Der groß und erhaben ist,",
        slideNumber: "4"
    },
    {
        arabic: "يا مُنْشِىءَ الْسَّحابِ الثِّقالِ يا مَنْ هُوَ شَديدُ الْمحالِ",
        german: "o Jener, Der die schweren Wolken erschafft, o Jener, Der unermesslich stark ist,",
        slideNumber: "4"
    },
    {
        arabic: "يا مَنْ هُوَ سَريعُ الْحِسابِ يا مَنْ هُوَ شَديدُ الْعِقابِ",
        german: "o Jener, Der schnell richtet, o Jener, Der streng bestraft,",
        slideNumber: "4"
    },
    {
        arabic: "يا مَنْ عِنْدَهُ حُسْنُ الثَّوابِ يا مَنْ عِنْدَهُ اُمُّ الْكِتابِ",
        german: "o Jener, bei Dem sich die schönste Belohnung befindet, o Jener, bei Dem sich die Mutter des Buches befindet.",
        slideNumber: "4"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا حَنّانُ يا مَنّانُ يا دَيّانُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Gnädiger, o Großzügiger, o gerecht Richtender",
        slideNumber: "5"
    },
    {
        arabic: "يا بُرْهانُ يا سُلْطانُ يا رِضْوانُ يا غُفْرانُ يا سُبْحانُ يا مُسْتَعانُ يا ذَا الْمَنِّ وَالْبَيانِ",
        german: "o Beweis, o Herrscher, o Zufriedensteller, o Vergebender, o Gepriesener, o um Hilfe Gebetener, o Eigner der Gunst und der Beredsamkeit.",
        slideNumber: "5"
    },
    {
        arabic: "يا مَنْ تَواضَعَ كُلُّ شَيْءٍ لِعَظَمَتِهِ يا مَنِ اسْتَسْلَمَ كُلُّ شَيْءٍ لِقُدْرَتِهِ",
        german: "o Jener, dessen Größe sich alles unterwirft, o Jener, dessen Allmacht sich alles unterordnet",
        slideNumber: "6"
    },
    {
        arabic: "يا مَنْ ذَلَّ كُلُّ شَيْءٍ لِعِزَّتِهِ يا مَنْ خَضَعَ كُلُّ شَيْءٍ لِهَيْبَتِهِ",
        german: "o Jener, vor Dessen Ehre sich alles erniedrigt, o Jener, Dessen Würde alles Folge leistet",
        slideNumber: "6"
    },
    {
        arabic: "يا مَنِ انْقادَ كُلُّ شَيْءٍ مِنْ خَشْيَتِهِ يا مَنْ تَشَقَّقَتِ الْجِبالُ مِنْ مَخافَتِهِ",
        german: "o Jener, Dessen Herrschaft sich alles fügt, o Jener, aus Furcht vor dem sich alles beugt",
        slideNumber: "6"
    },
    {
        arabic: "يا مَنْ قامَتِ السَّماواتُ بِاَمْرِهِ يا مَنِ اسْتَقَرَّتِ الاْرَضُونَ بِاِذْنِهِ",
        german: "o Jener, aus Furcht vor dem sich die Berge spalten, o Jener Dessen Befehl die Himmel aufrecht erhält",
        slideNumber: "6"
    },
    {
        arabic: "يا مَنْ يُسَبِّحُ الرَّعْدُ بِحَمْدِهِ يا مَنْ لا يَعْتَدي عَلى اَهْلِ مَمْلَكَتِهِ",
        german: "o Jener, mit Dessen Erlaubnis die Erde von Bestand ist, o Jener, der Du nicht ungerecht gegen die Bewohner des Königreichs handelst",
        slideNumber: "6"
    },
    {
        arabic: "يا غافِرَ الْخَطايا يا كاشِفَ الْبَلايا يا مُنْتَهَى الرَّجايا يا مُجْزِلَ الْعَطايا",
        german: "o Verzeihender der Fehler, o Beseitigender des Unheils, o letzte Instanz der Hoffnungen, o reichlich Schenkender der Gaben,",
        slideNumber: "7"
    },
    {
        arabic: "يا واهِبَ الْهَدايا يا رازِقَ الْبَرايا",
        german: "o Gewährer der Geschenke, o Ernährer der Geschöpfe,",
        slideNumber: "7"
    },
    {
        arabic: "يا قاضِيَ الْمَنايا يا سامِعَ الشَّكايا يا باعِثَ الْبَرايا يا مُطْلِقَ الأُسارى",
        german: "o Richter über die Geschicke, o Erhörender der Klagen, o die Geschöpfe zum Leben Erweckender, o Befreier der Gefangenen.",
        slideNumber: "7"
    },
    {
        arabic: "يا ذَا الْحَمْدِ وَالثَّناءِ يا ذَا الْفَخْرِ وَاْلبَهاءِ يا ذَا الْمجْدِ وَالسَّناءِ يا ذَا الْعَهْدِ وَالْوَفاءِ",
        german: "o Eigentümer des Lobes und des Preises, o Eigentümer des Ruhmes und des Glanzes, o Eigentümer der Ehre und der Erhabenheit, o Eigentümer des Vertrags und seiner Einhaltung",
        slideNumber: "8"
    },
    {
        arabic: "يا ذَا الْعَفْوِ وَالرِّضاءِ يا ذَا الْمَنِّ وَالْعَطاءِ",
        german: "o Eigentümer der Vergebung und der Zufriedenheit, o Eigentümer der Gunst und der Gewährung",
        slideNumber: "8"
    },
    {
        arabic: "يا ذَا الْفَصْلِ وَالْقَضاءِ يا ذَا الْعِزِّ وَالْبَقاءِ يا ذَا الْجُودِ وَالسَّخاءِ يا ذَا الألآءِ وَالنَّعْماءِ",
        german: "o Eigentümer der Entscheidung und des Urteils, o Eigentümer der Macht und der Ewigkeit, o Eigentümer der Freigiebigkeit und der Gunstbeweise, o Eigentümer der Wohltaten und der Gaben.",
        slideNumber: "8"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مانِعُ يا دافِعُ يا رافِعُ يا صانِعُ يا نافِعُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Verhinderer, o Verteidiger, o Erhörer, o Erschaffer, o Wohltäter,",
        slideNumber: "9"
    },
    {
        arabic: "يا سامِعُ يا جامِعُ يا شافِعُ يا واسِعُ يا مُوسِعُ",
        german: "o Erhörender, o Vereinender, o Fürsprecher, o Weitreichender, o reichlich Vermögender.",
        slideNumber: "9"
    },
    {
        arabic: "يا صانِعَ كُلِّ مَصْنُوعٍ يا خالِقَ كُلِّ مَخْلُوقٍ يا رازِقَ كُلِّ مَرْزُوقٍ يا مالِكَ كُلِّ مَمْلُوكٍ",
        german: "o Erschaffer alles Erschaffenen, o Schöpfer aller Geschöpfe, o Versorger all dessen, was versorgt wird, o Herrscher aller Beherrschten,",
        slideNumber: "10"
    },
    {
        arabic: "يا كاشِفَ كُلِّ مَكْرُوبٍ يا فارِجَ كُلِّ مَهْمُومٍ",
        german: "o Erlöser aller Leidenden, o Befreier aller Bekümmerten",
        slideNumber: "10"
    },
    {
        arabic: "يا راحِمَ كُلِّ مَرْحُومٍ يا ناصِرَ كُلِّ مَخْذُولٍ يا ساتِرَ كُلِّ مَعْيُوبٍ يا مَلْجَأَ كُلِّ مَطْرُودٍ",
        german: "o Erbarmer aller Erbarmten, o Beistand aller in Stich gelassenen, o Verhüller aller Fehlerbehafteten, o Zuflucht aller Ausgestoßenen.",
        slideNumber: "10"
    },
    {
        arabic: "يا عُدَّتي عِنْدَ شِدَّتي يا رَجائي عِنْدَ مُصيبَتي يا مُونِسي عِنْدَ وَحْشَتي يا صاحِبي عِنْدَ غُرْبَتي",
        german: "o mein Helfer in meiner Not, o meine Hoffnung in meiner Heimsuchung, o mein Vertrauter in meiner Einsamkeit, o mein Gefährte in meiner Fremde,",
        slideNumber: "11"
    },
    {
        arabic: "يا وَلِيّي عِنْدَ نِعْمَتي يا غِياثي عِنْدَ كُرْبَتي",
        german: "o mein Wohltäter in meinen Gaben, o mein Helfer in meinen Sorgen,",
        slideNumber: "11"
    },
    {
        arabic: "يا دَليلي عِنْدَ حَيْرَتي يا غَنائي عِنْدَ افْتِقاري يا مَلجَأي عِنْدَ اضْطِراري يا مُعيني عِنْدَ مَفْزَعي",
        german: "o mein Wegweiser in meiner Verwirrung, o mein Reichtum in meiner Mittellosigkeit, o meine Zuflucht in meiner Notlage, o mein Beistand in meinem Schrecken.",
        slideNumber: "11"
    },
    {
        arabic: "يا عَلاّمَ الْغُيُوبِ يا غَفّارَ الذُّنُوبِ يا سَتّارَ الْعُيُوبِ يا كاشِفَ الْكُرُوبِ يا مُقَلِّبَ الْقُلُوبِ يا طَبيبَ الْقُلُوبِ",
        german: "o Wissender der verborgenen Dinge, o Vergebender der Sünden, o Verhüller der Fehler, o Beseitigender des Unheils, o Verfügender über die Herzen, o Heiler der Herzen, o Erleuchtender der Herzen,",
        slideNumber: "12"
    },
    {
        arabic: "يا مُنَوِّرَ الْقُلُوبِ يا اَنيسَ الْقُلُوبِ يا مُفَرِّجَ الْهُمُومِ يا مُنَفِّسَ الْغُمُومِ",
        german: "o Erleuchtender der Herzen, o Geselliger der Herzen, o Erlöser von den Sorgen, o Befreier von den Kümmernissen.",
        slideNumber: "12"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاْسمِكَ يا جَليلُ يا جَميلُ يا وَكيلُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Majestätischer, o Schöner, o Sachwalter,",
        slideNumber: "13"
    },
    {
        arabic: "يا كَفيلُ يا دَليلُ يا قَبيلُ يا مُديلُ يا مُنيلُ يا مُقيلُ يا مُحيلُ",
        german: "o Bürge, o Wegweiser, o Garant, o Nahebringender, o Ermöglichender des Erlangens, o Hilfeeilender, o Kraftspender.",
        slideNumber: "13"
    },
    {
        arabic: "يا دَليلَ الْمُتَحَيِّرينَ يا غِياثَ الْمُسْتَغيثينَ يا صَريخَ الْمُسْتَصْرِخينَ يا جارَ الْمُسْتَجيرينَ",
        german: "o Wegweiser der Verwirrten, o Rettung der Rettungssuchenden, o Hilfreicher der um Hilfe Rufenden, o Schutz der Schutzsuchenden,",
        slideNumber: "14"
    },
    {
        arabic: "يا اَمانَ الْخائِفينَ يا عَوْنَ الْمُؤْمِنينَ",
        german: "o Sicherheit der Beängstigten, o Helfer der Gläubigen,",
        slideNumber: "14"
    },
    {
        arabic: "يا راحِمَ الْمَساكينَ يا مَلْجَأَ الْعاصينَ يا غافِرَ الْمُذْنِبينَ يا مُجيبَ دَعْوَةِ الْمُضْطَرّينَ",
        german: "o Erbarmer der Elenden, o Zuflucht der Ungehorsamen, o Vergebender der Sündigen, o Erhörender des Rufes der Bedrängten.",
        slideNumber: "14"
    },
    {
        arabic: "يا ذَا الْجُودِ وَالاْحْسانِ يا ذَا الْفَضْلِ وَالاْمْتِنانِ يا ذَا الاْمْنِ وَالاْمانِ يا ذَا الْقُدْسِ وَالسُّبْحانِ",
        german: "o Eigner der Freigebigkeit und der Wohltätigkeit, o Eigner der Huld und der Güte, o Eigner des Schutzes und der Sicherheit, o Eigner der Heiligkeit und der Verherrlichung,",
        slideNumber: "15"
    },
    {
        arabic: "يا ذَا الْحِكْمَةِ وَالْبَيانِ يا ذَا الرَّحْمَةِ وَالرِّضْوانِ",
        german: "o Eigner der Weisheit und der Beredsamkeit, o Eigner der Gnade und der Zufriedenheit,",
        slideNumber: "15"
    },
    {
        arabic: "يا ذَا الْحُجَّةِ وَالْبُرْهانِ يا ذَا الْعَظَمَةِ وَالسُّلْطانِ يا ذَا الرَّأْفَةِ وَالْمُسْتَعانِ يا ذَا العَفْوِ وَالْغُفْرانِ",
        german: "o Eigner des Arguments und des Beweises, o Eigner der Größe und der unumschränkten Macht, o Eigner der Gnade und der Unterstützung, o Eigner der Verzeihung und der Vergebung.",
        slideNumber: "15"
    },
    {
        arabic: "يا مَنْ هُوَ رَبُّ كُلِّ شَيْءٍ يا مَنْ هُوَ اِلـهُ كُلِّ شَيءٍ يا مَنْ هُوَ خالِقُ كُلِّ شَيْءٍ",
        german: "o Jener, Der Herr aller Dinge ist, o Jener, Der Gott aller Dinge ist, o Jener, Der Schöpfer aller Dinge ist,",
        slideNumber: "16"
    },
    {
        arabic: "يا مَنْ هُوَ صانِعُ كُلِّ شَيْءٍ يا مَنْ هُوَ قَبْلَ كُلِّ شَيْءٍ يا مَنْ هُوَ بَعْدَ كُلِّ شَيْءٍ",
        german: "o Jener, Der Erschaffer aller Dinge ist, o Jener, Der vor Allem war, o Jener, Der nach Allem sein wird,",
        slideNumber: "16"
    },
    {
        arabic: "يا مَنْ هُوَ فَوْقَ كُلِّ شَيْءٍ يا مَنْ هُوَ عالِمٌ بِكُلِّ شَيْءٍ",
        german: "o Jener, Der über Allem steht, o Jener, Der alles weiß,",
        slideNumber: "16"
    },
    {
        arabic: "يا مَنْ هُوَ قادِرٌ عَلى كُلِّ شَيْءٍ يا مَنْ هُوَ يَبْقى وَيَفْنى كُلُّ شَيْءٍ",
        german: "o Jener, Der Macht über alle Dinge besitzt, o Jener, Der beständig ist, während alles (andere) vergänglich ist.",
        slideNumber: "16"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُؤْمِنُ يا مُهَيْمِنُ يا مُكَوِّنُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Überzeugender, o Beherrscher, o Urheber,",
        slideNumber: "17"
    },
    {
        arabic: "يا مُلَقِّنُ يا مُبَيِّنُ يا مُهَوِّنُ يا مُمَكِّنُ يا مُزَيِّنُ يا مُعْلِنُ يا مُقَسِّمُ",
        german: "o Unterweiser, o Aufzeigender, o Erleichterer, o Ermöglicher, o Verschönerer, o Verkünder, o Verteilender.",
        slideNumber: "17"
    },
    {
        arabic: "يا مَنْ هُوَ في مُلْكِهِ مُقيمٌ يا مَنْ هُوَ في سُلْطانِهِ قديم يا مَنْ هُو في جَلالِهِ عَظيمٌ",
        german: "o Jener, Der in seinem Königreich ewig ist, o Jener, Der in seiner unumschränkten Herrschaft immerwährend ist, o Jener, Der in seiner Pracht groß ist,",
        slideNumber: "18"
    },
    {
        arabic: "يا مَنْ هُوَ عَلى عِبادِهِ رَحيمٌ يا مَنْ هُوَ بِكُلِّ شَيْءٍ عَليمٌ يا مَنْ هُوَ بِمَنْ عَصاهُ حَليمٌ",
        german: "o Jener, Der gegenüber seinen Dienern begnadend ist, o Jener, Der Wissend über alles ist, o Jener, Der nachsichtig gegenüber jenen ist, die Ihm gegenüber ungehorsam waren,",
        slideNumber: "18"
    },
    {
        arabic: "يا مَنْ هُوَ بِمَنْ رَجاهُ كَريمٌ يا مَنْ هُوَ في صُنْعِهِ حَكيمٌ يا مَنْ هُوَ في حِكْمَتِهِ لَطيفٌ يا مَنْ هُوَ في لُطْفِهِ قَديمٌ",
        german: "o Jener, Der gegenüber jenen, die auf Ihn hoffen, großzügig ist, o Jener, Der in Seinem Handeln weise ist, o Jener, Der in Seiner Weisheit nachsichtig ist, o Jener, Dessen Nachsicht immerwährend ist.",
        slideNumber: "18"
    },
    {
        arabic: "يا مَنْ لا يُرْجى إلاّ فَضْلُهُ يا مَنْ لا يُسْأَلُ إلاّ عَفْوُهُ يا مَنْ لا يُنْظَرُ إلاّ بِرُّهُ",
        german: "o Jener, außer Dessen Huld nichts erhofft wird, o Jener, außer Dessen Vergebung nichts erbeten wird, o Jener, außer Dessen Güte nichts erwartet wird,",
        slideNumber: "19"
    },
    {
        arabic: "يا مَنْ لا يُخافُ إلاّ عَدْلُهُ يا مَنْ لا يَدُومُ إلاّ مُلْكُهُ يا مَنْ لا سُلْطانَ إلاّ سُلْطانُهُ",
        german: "o Jener, außer Dessen Gerechtigkeit nichts gefürchtet wird, o Jener, außer Dessen Reich nichts überdauert, o Jener, außer Dessen Herrschaftsgewalt es keine Herrschaftsgewalt gibt,",
        slideNumber: "19"
    },
    {
        arabic: "يا مَنْ وَسِعَتْ كُلَّ شَيْءٍ رَحْمَتُهُ يا مَنْ سَبَقَتْ رَحْمَتُهُ غَضَبَهُ",
        german: "o Jener, Dessen Gnade alles umfasst, o Jener, Dessen Gnade Seinen Zorn übertrifft,",
        slideNumber: "19"
    },
    {
        arabic: "يا مَنْ اَحاطَ بِكُلِّ شَيْءٍ عِلْمُهُ يا مَنْ لَيْسَ اَحَدٌ مِثْلَهُ",
        german: "o Jener, Dessen Wissen alles umfasst, o Jener, dem keiner ähnelt.",
        slideNumber: "19"
    },
    {
        arabic: "يا فارِجَ الْهَمِّ يا كاشِفَ الْغَمِّ يا غافِرَ الذَّنْبِ يا قابِلَ التَّوْبِ يا خالِقَ الْخَلْقِ",
        german: "o Befreier von den Sorgen, o Beseitigender des Kummers, o Vergebender der Sünden, o Annehmender der Reue, o Schöpfer der Schöpfung,",
        slideNumber: "20"
    },
    {
        arabic: "يا صادِقَ الْوَعْدِ يا مُوفِيَ الْعَهْدِ يا عالِمَ السِّرِّ يا فالِقَ الْحَبِّ يا رازِقَ الاْنامِ",
        german: "o Jener, Der Seinem Versprechen treu ist, o Einhalter des Vertrages, o Wissender der Geheimnisse, o Spalter der Samenkörner, o Ernährer der Menschen.",
        slideNumber: "20"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا عَلِيُّ يا وَفِيُّ يا غَنِيُّ يا مَلِيُّ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Höchster, o Treuer, o Sich Selbst Genügender, o Zeitloser,",
        slideNumber: "21"
    },
    {
        arabic: "يا حَفِيُّ يا رَضِيُّ يا زَكِيُّ يا بَدِيُّ يا قَوِيُّ يا وَلِيُّ",
        german: "o Ehrender, o Zufriedener, o Reiner, o Offenbarer, o Starker, o Vormund.",
        slideNumber: "21"
    },
    {
        arabic: "يا مَنْ اَظْهَرَ الْجَميلَ يا مَنْ سَتَرَ الْقَبيحَ يا مَنْ لَمْ يُؤاخِذْ بِالْجَريرَةِ",
        german: "o Jener, Der das Schöne enthüllt, o Jener, Der das Hässliche verhüllt, o Jener, Der das Verbrechen nicht gleich bestraft,",
        slideNumber: "22"
    },
    {
        arabic: "يا مَنْ لَمْ يَهْتِكِ السِّتْرَ يا عَظيمَ الْعَفْوِ يا حَسَنَ التَّجاوُزِ يا واسِعَ الْمَغْفِرَةِ",
        german: "o Jener, Der das Schöne enthüllt, o Jener, Der das Hässliche verhüllt, o Jener, Der das Verbrechen nicht gleich bestraft, o Jener, Der den Schutz nicht entreißt, o Jener, Dessen Vergebung groß ist, o Jener, Der gütig unbestraft lässt, o Jener, Dessen Vergebung allumfassend ist,",
        slideNumber: "22"
    },
    {
        arabic: "يا باسِطَ الْيَدَيْنِ بِالرَّحْمَةِ يا صاحِبَ كُلِّ نَجْوى يا مُنْتَهى كُلِّ شَكْوى",
        german: "o Jener, Der mit Gnade freigiebig ist, o Gefährte aller stillen Gebete, o letzte Instanz aller Beschwerden.",
        slideNumber: "22"
    },
    {
        arabic: "يا ذَا النِّعْمَةِ السّابِغَةِ يا ذَا الرَّحْمَةِ الْواسِعَةِ يا ذَا الْمِنَّةِ السّابِقَةِ يا ذَا الْحِكْمَةِ الْبالِغَةِ",
        german: "o Eigner der im Überfluss vorhandenen Gaben, o Eigner der weitreichenden Gnade, o Eigner vergangener Gunst, o Eigner der außerordentlichen Weisheit,",
        slideNumber: "23"
    },
    {
        arabic: "يا ذَا الْقُدْرَةِ الْكامِلَةِ يا ذَا الْحُجَّةِ الْقاطِعَةِ",
        german: "o Eigner der absoluten Macht, o Eigner des schlagenden Arguments,",
        slideNumber: "23"
    },
    {
        arabic: "يا ذَا الْكَرامَةِ الظّاهِرَةِ يا ذَا الْعِزَّةِ الدّائِمَةِ يا ذَا الْقُوَّةِ الْمَتينَةِ يا ذَا الْعَظَمَةِ الْمَنيعَةِ",
        german: "o Eigner der offensichtlichen Ehre, o Eigner der dauerhaften Erhabenheit, o Eigner der festen Macht, o Eigner der unüberwindbaren Größe.",
        slideNumber: "23"
    },
    {
        arabic: "يا بَديعَ السَّماواتِ يا جاعِلَ الظُّلُماتِ يا راحِمَ الْعَبَراتِ يا مُقيلَ الْعَثَراتِ",
        german: "o Schöpfer der Himmel, o Errichter der Finsternisse,o Erbarmer der Tränen, o Aufhebender der Verfehlungen",
        slideNumber: "24"
    },
    {
        arabic: "يا ساتِرَ الْعَوْراتِ يا مُحْيِيَ الأمْواتِ",
        german: "o Auslöschender der schlechten Taten, o Strenger der Bestrafenden.",
        slideNumber: "24"
    },
    {
        arabic: "يا مُنْزِلَ الآياتِ يا مُضَعِّفَ الْحَسَناتِ يا ماحِيَ السَّيِّئاتِ يا شَديدَ النَّقِماتِ",
        german: "o Herabsendender der Zeichen, o Vervielfacher der guter Taten, o Auslöschender der schlechten Taten, o Strenger der Bestrafenden.",
        slideNumber: "24"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُصَوِّرُ يا مُقَدِّرُ يا مُدَبِّرُ يا مُطَهِّرُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Gestalter, o Vorbestimmender, o Waltender, o Bereinigender,",
        slideNumber: "25"
    },
    {
        arabic: "يا مُنَوِّرُ يا مُيَسِّرُ يا مُبَشِّرُ يا مُنْذِرُ يا مُقَدِّمُ يا مُؤَخِّرُ",
        german: "o Erleuchtender, o Erleichterer, o Verkünder, o Ermahner, o Vorziehender, o Aufschiebender.",
        slideNumber: "25"
    },
    {
        arabic: "يا رَبَّ الْبَيْتِ الْحَرامِ يا رَبَّ الشَّهْرِ الْحَرامِ يا رَبَّ الْبَلَدِ الْحَرامِ",
        german: "o Herr des geweihten Hauses, o Herr des geweihten Monats, o Herr der geweihten Stadt",
        slideNumber: "26"
    },
    {
        arabic: "يا رَبَّ الرُّكْنِ وَالْمَقامِ يا رَبَّ الْمَشْعَرِ الْحَرامِ يا رَبَّ الْمَسْجِدِ الْحَرامِ",
        german: "o Herr der Stellung und des Ranges, o Herr des geweihten “Maschar“, o Herr der geweihten Moschee,",
        slideNumber: "26"
    },
    {
        arabic: "يا رَبَّ الْحِلِّ وَالْحَرامِ يا رَبَّ النُّورِ وَالظَّلامِ يا رَبَّ التَّحِيَّةِ وَالسَّلامِ يا رَبَّ الْقُدْرَةِ فِي الاْنام",
        german: "o Herr des Erlaubten und des Verbotenen, o Herr des Lichtes und der Finsternis o Herr der Begrüßung und des Friedens o Herr der Macht über die Menschen.",
        slideNumber: "26"
    },
    {
        arabic: "يا اَحْكَمَ الْحاكِمينَ يا اَعْدَلَ الْعادِلينَ يا اَصْدَقَ الصّادِقينَ",
        german: "o Mächtigster der Regierenden, o Gerechtester der Gerechten, o Aufrichtigster der Aufrichtigen,",
        slideNumber: "27"
    },
    {
        arabic: "يا اَطْهَرَ الطّاهِرينَ يا اَحْسَنَ الْخالِقينَ يا اَسْرَعَ الْحاسِبينَ",
        german: "o Reinster der Reinen, o Schönster der Schöpfer, o Schnellster der Abrechnenden,",
        slideNumber: "27"
    },
    {
        arabic: "يا اَسْمَعَ السّامِعينَ يا اَبْصَرَ النّاظِرينَ يا اَشْفَعَ الشّافِعينَ يا اَكْرَمَ الاْكْرَمينَ",
        german: "Besthörender der Hörenden, o Scharfsichtiger der Schauenden, o bester Fürsprecher der Fürsprecher, o Großzügigster der Großzügigen.",
        slideNumber: "27"
    },
    {
        arabic: "يا عِمادَ مَنْ لا عِمادَ لَهُ يا سَنَدَ مَنْ لا سَنَدَ لَهُ يا ذُخْرَ مَنْ لا ذُخْرَ لَهُ",
        german: "o Stütze dessen, der keine Stütze hat, o Rückhalt dessen, der keinen Rückhalt hat, o Reichtum dessen, der keinen Reichtum hat,",
        slideNumber: "28"
    },
    {
        arabic: "يا حِرْزَ مَنْ لا حِرْزَ لَهُ يا غِياثَ مَنْ لا غِياثَ لَهُ يا فَخْرَ مَنْ لا فَخْرَ لَهُ",
        german: "o Festung dessen, der keine Festung hat, o Retter dessen, der keinen Retter hat, o Stolz dessen, der keinen Stolz hat,",
        slideNumber: "28"
    },
    {
        arabic: "يا عِزَّ مَنْ لا عِزَّ لَهُ يا مُعينَ مَنْ لا مُعينَ لَهُ يا اَنيسَ مَنْ لا اَنيسَ لَهُ يا اَمانَ مَنْ لا اَمانَ لَهُ",
        german: "o Ruhm dessen, der keinen Ruhm hat, o Beistand dessen, der keinen Beistand hat, o Gefährte dessen, der keinen Gefährten hat, o Sicherheit dessen, der keine Sicherheit hat.",
        slideNumber: "28"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا عاصِمُ يا قائِمُ يا دائِمُ يا راحِمُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Beschützer, o Währender, o Ewiger, o Erbarmer,",
        slideNumber: "29"
    },
    {
        arabic: "يا سالِمُ يا حاكِمُ يا عالِمُ يا قاسِمُ يا قابِضُ يا باسِطُ",
        german: "o Unfehlbarer, o Regierender, o Allwissender, o Verteiler, o Begrenzender, o Ausbreitender.",
        slideNumber: "29"
    },
    {
        arabic: "يا عاصِمَ مَنِ اسْتَعْصَمَهُ يا راحِمَ مَنِ اسْتَرْحَمَهُ يا غافِرَ مَنِ اسْتَغْفَرَهُ",
        german: "o Beschützer derer, die Seinen Schutz suchen, o Erbarmer derer, die Ihn um Erbarmen anflehen, o Vergebender derer, die Seine Vergebung erhoffen",
        slideNumber: "30"
    },
    {
        arabic: "يا ناصِرَ مَنِ اسْتَنْصَرَهُ يا حافِظَ مَنِ اسْتَحْفَظَهُ يا مُكْرِمَ مَنِ اسْتَكْرَمَهُ",
        german: "o Helfer derer, die Ihn um Hilfe ersuchen, o Hüter derer, die sich Seiner Obhut anvertrauen, o Wohltäter derer, die Seine Wohltaten erhoffen,",
        slideNumber: "30"
    },
    {
        arabic: "يا مُرْشِدَ مَنِ اسْتَرْشَدَهُ يا صَريخَ مَنِ اسْتَصْرَخَهُ",
        german: "o Wegweiser derer, die nach Seiner Weisung verlangen, o Erlöser derer, die zu Ihm um Erlösung rufen,",
        slideNumber: "30"
    },
    {
        arabic: "يا مُعينَ مَنِ اسْتَعانَهُ يا مُغيثَ مَنِ اسْتَغاثَهُ",
        german: "o Beistand derer, die Seinen Beistand ersehnen, o Erretter derer, die Ihn um Rettung ersuchen.",
        slideNumber: "30"
    },
    {
        arabic: "يا عَزيزاً لا يُضامُ يا لَطيفاً لا يُرامُ يا قَيُّوماً لا يَنامُ يا دائِماً لا يَفُوتُ",
        german: "o Mächtiger, Der nicht geschädigt werden kann, o Gütiger, Der unerreichbar ist, o Beständiger, Der niemals schläft, o Ewiger, Der niemals vergeht,",
        slideNumber: "31"
    },
    {
        arabic: "يا حَيّاً لا يَمُوتُ يا مَلِكاً لا يَزُولُ يا باقِياً لا يَفْنى",
        german: "o Lebendiger, Der niemals stirbt, o König, Der niemals zugrunde geht, O Überlebender, Der niemals untergeht,",
        slideNumber: "31"
    },
    {
        arabic: "يا عالِماً لا يَجْهَلُ يا صَمَداً لا يُطْعَمُ يا قَوِيّاً لا يَضْعُفُ",
        german: "o Allwissender, Der niemals unwissend ist, o Unabhängiger, Der nicht auf Nahrung angewiesen ist, o Starker, Der niemals schwach ist.",
        slideNumber: "31"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَحَدُ يا واحِدُ يا شاهِدُ يا ماجِدُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Einziger, o Einer o Bezeugender, o Gerühmter,",
        slideNumber: "32"
    },
    {
        arabic: "يا حامِدُ يا راشِدُ يا باعِثُ يا وارِثُ يا ضارُّ يا نافِعُ",
        german: "o Lobender, o Rechtleitender, o Lebenserweckender, o Erbe, o Schädigungsfähiger, o Wohltäter.",
        slideNumber: "32"
    },
    {
        arabic: "يا اَعْظَمَ مِنْ كُلِّ عَظيمٍ يا اَكْرَمَ مِنْ كُلِّ كَريمٍ يا اَرْحَمَ مِنْ كُلِّ رَحيمٍ",
        german: "o Gewaltigster aller Gewaltigen, o Großzügigster aller Großzügigen, o Gnädigster aller Begnadenden,",
        slideNumber: "33"
    },
    {
        arabic: "يا اَعْلَمَ مِنْ كُلِّ عَليمٍ يا اَحْكَمَ مِنْ كُلِّ حَكيمٍ يا اَقْدَمَ مِنْ كُلِّ قَديمٍ",
        german: "o Wissendster aller Wissenden, o Höchstregierender aller Regierenden, o Existierender vor jeder Existenz,",
        slideNumber: "33"
    },
    {
        arabic: "يا اَكْبَرَ مِنْ كُلِّ كَبيرٍ يا اَلْطَفَ مِنْ كُلِّ لَطيفٍ يا اَجَلَّ مِن كُلِّ جَليلٍ يا اَعَزَّ مِنْ كُلِّ عَزيزٍ",
        german: "o Größter aller Größen, o Gütigster aller Gütigen, o Majestätischster aller Majestätischen, o Kraftvollster aller Kraftvollen.",
        slideNumber: "33"
    },
    {
        arabic: "يا كَريمَ الصَّفْحِ يا عَظيمَ الْمَنِّ يا كَثيرَ الْخَيْرِ يا قَديمَ الْفَضْلِ يا دائِمَ اللُّطْفِ يا لَطيفَ الصُّنْعِ",
        german: "o großzügig Verzeihender, o Dessen Gunst groß ist, o Dessen Wohltaten viele sind, o Dessen Huld beständig ist, o Dessen Sanftmütigkeit ewig ist, o Dessen Handeln gütig ist",
        slideNumber: "34"
    },
    {
        arabic: "يا مُنَفِّسَ الْكَرْبِ يا كاشِفَ الضُّرِّ يا مالِكَ الْمُلْكِ يا قاضِيَ الْحَقِّ",
        german: "o Erlöser vom Unheil, o Beseitigender des Schadens, o Eigentümer jedes Eigentums, o Richter des Rechts",
        slideNumber: "34"
    },
    {
        arabic: "يا مَنْ هُوَ في عَهْدِهِ وَفِيٌّ يا مَنْ هُوَ في وَفائِهِ قَوِيٌّ يا مَنْ هُوَ في قُوَّتِهِ عَلِيٌّ",
        german: "o Jener, Der Sein Versprechen erfüllt, o Jener, Der in der Erfüllung Seines Versprechens stark ist, o Jener, Der in Seiner Stärke erhaben ist,",
        slideNumber: "35"
    },
    {
        arabic: "يا مَنْ هُوَ في عُلُوِّهِ قَريبٌ يا مَنْ هُوَ في قُرْبِهِ لَطيفٌ يا مَنْ هُوَ في لُطْفِهِ شَريفٌ",
        german: "o Jener, Der in Seiner Erhabenheit nah ist, o Jener, Der in Seiner Nähe gütig ist, o Jener, Der in Seiner Gütigkeit ehrenhaft ist,",
        slideNumber: "35"
    },
    {
        arabic: "يا مَنْ هُوَ في شَرَفِهِ عَزيزٌ يا مَنْ هُوَ في عِزِّهِ عَظيمٌ يا مَنْ هُوَ في عَظَمَتِهِ مَجيدٌ يا مَنْ هُوَ في مَجْدِهِ حَميدٌ",
        german: "o Jener, Der in Seiner Ehrenhaftigkeit mächtig ist, o Jener, Der in Seiner Macht groß ist, o Jener, Der in Seiner Größe ruhmreich ist, o Jener, Der in Seinem Ruhm lobenswert ist.",
        slideNumber: "35"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا كافي يا شافي يا وافى يا مُعافي",
        german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Abwendender, o Heiler, o Genügender, o Schützer,",
        slideNumber: "36"
    },
    {
        arabic: "يا هادي يا داعي يا قاضي يا راضي يا عالي يا باقي",
        german: "o Rechtleiter, o Einladender, o Richter, o Zufriedenstellender, o Hoher, o Überlebender.",
        slideNumber: "36"
    },
    {
        arabic: "يا مَنْ كُلُّ شَيْءٍ خاضِعٌ لَهُ يا مَنْ كُلُّ شَيْءٍ خاشِعٌ لَهُ يا مَنْ كُلُّ شَيْءٍ كائِنٌ لَهُ",
        german: "o Jener, Dem sich alles unterwirft, o Jener, gegenüber Dem alles demütig ist, o Jener, für Den alles existiert,",
        slideNumber: "37"
    },
    {
        arabic: "يا مَنْ كُلُّ شَيْءٍ مَوْجُودٌ بِهِ يا مَنْ كُلُّ شَيْءٍ مُنيبٌ اِلَيْهِ يا مَنْ كُلُّ شَيْءٍ خائِفٌ مِنْهُ",
        german: "o Jener, durch Den alles existiert, o Jener, zu Dem alle Reue zeigen, o Jener, vor Dem sich alles fürchtet,",
        slideNumber: "37"
    },
    {
        arabic: "يا مَنْ كُلُّ شَيْءٍ قائِمٌ بِهِ يا مَنْ كُلُّ شَيْءٍ صائِرٌ اِلَيْهِ",
        german: "o Jener, durch Den alles aufrecht ist, o Jener, zu Dem alles gelangt,",
        slideNumber: "37"
    },
    {
        arabic: "يا مَنْ كُلُّ شَيْءٍ يُسَبِّحُ بِحَمْدِهِ يا مَنْ كُلُّ شَيْءٍ هالِكٌ إلاّ وَجْهَهُ",
        german: "o Jener, Den alles in Seiner Dankbarkeit lobpreist, o Jener, außer Dessen Antlitz alles untergeht.",
        slideNumber: "37"
    },
    {
        arabic: "يا مَنْ لا مَفَرَّ إلاّ اِلَيْهِ يا مَنْ لا مَفْزَعَ إلاّ اِلَيْهِ يا مَنْ لا مَقْصَدَ إلاّ اِلَيْهِ",
        german: "o Jener, außer Dem es keinen Ausweg gibt, o Jener, außer Dem es keinen Zufluchtsort gibt, o Jener, außer Dem es kein Ziel gibt,",
        slideNumber: "38"
    },
    {
        arabic: "يا مَنْ لا مَنْجا مِنْهُ إلاّ اِلَيْهِ يا مَنْ لا يُرْغَبُ إلاّ اِلَيْهِ يا مَنْ لا حَوْلَ وَلا قُوَّةَ إلاّ بِهِ",
        german: "o Jener, außer Dem es keine Rettung gibt, o Jener, außer Dem nichts erwünscht wird, o Jener, außer durch Den es keine Kraft, noch Macht gibt,",
        slideNumber: "38"
    },
    {
        arabic: "يا مَنْ لا يُسْتَعانُ إلاّ بِهِ يا مَنْ لا يُتَوَكَّلُ إلاّ عَلَيْهِ يا مَنْ لا يُرْجى إلاّ هُوَ يا مَنْ لا يُعْبَدُ إلاّ هو",
        german: "o Jener, außer Dem niemand um Hilfe gebeten wird, o Jener, außer Dem kein Verlass ist, o Jener, außer Dem niemand gebeten wird, o Jener, außer Dem niemand angebetet wird.",
        slideNumber: "38"
    },
    {
        arabic: "يا خَيْرَ الْمَرْهُوبينَ يا خَيْرَ الْمَرْغُوبينَ يا خَيْرَ الْمَطْلُوبينَ",
        german: "O Segenreichster der Gefürchteten, o Segenreichster der Erwünschten, o Segenreichster der Begehrten,",
        slideNumber: "39"
    },
    {
        arabic: "يا خَيْرَ الْمَسْؤولينَ يا خَيْرَ الْمَقْصُودينَ يا خَيْرَ الْمَذْكُورينَ",
        german: "o Segenreichster der Verantwortlichen, o Segenreichster der Erstrebten, o Segenreichster der Erwähnten,",
        slideNumber: "39"
    },
    {
        arabic: "يا خَيْرَ الْمَشْكُورينَ يا خَيْرَ الْمحْبُوبينَ يا خَيْرَ الْمَدْعُوّينَ يا خَيْرَ الْمُسْتَأْنِسينَ",
        german: "o Segenreichster der Gedankten, o Segenreichster der Geliebten, o Segenreichster der Angebetenen, o Segenreichster der Anvertrauten.",
        slideNumber: "39"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا غافِرُ يا ساتِرُ يا قادِرُ يا قاهِرُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Vergebender, o Verhüller, o Mächtiger, o Bezwinger,",
        slideNumber: "40"
    },
    {
        arabic: "يا فاطِرُ يا كاسِرُ يا جابِرُ يا ذاكِرُ يا ناظِرُ يا ناصِرُ",
        german: "o Schöpfer, o Besiegender, o Zwingender, o Erwähnender, o Prüfender, o Unterstützer.",
        slideNumber: "40"
    },
    {
        arabic: "يا مَنْ خَلَقَ فَسَوّى يا مَنْ قَدَّرَ فَهَدى يا مَنْ يَكْشِفُ الْبَلْوى",
        german: "o Jener, Der erschaffen und geordnet hat, o Jener, Der bestimmt und den rechten Weg gewiesen hat, o Jener, Der das Unheil beseitigt,",
        slideNumber: "41"
    },
    {
        arabic: "يا مَنْ يَسْمَعُ النَّجْوى يا مَنْ يُنْقِذُ الْغَرْقى يا مَنْ يُنْجِي الْهَلْكى",
        german: "o Jener, Der die heimlichen Unterredungen hört, o Jener, Der die Ertrinkenden rettet, o Jener, Der die zu Grunde Gehenden birgt,",
        slideNumber: "41"
    },
    {
        arabic: "يا مَنْ يَشْفِي الْمَرْضى يا مَنْ اَضْحَكَ وَاَبْكى",
        german: "o Jener, Der die Kranken heilt, o Jener, Der lachen und weinen lässt,",
        slideNumber: "41"
    },
    {
        arabic: "يا مَنْ اَماتَ وَاَحْيى يا مَنْ خَلَقَ الزَّوْجَيْنِ الذَّكَرَ وَالاْنْثى",
        german: "o Jener, Der leben und sterben lässt, o Jener, Der die Paare erschaffen hat, das Männliche und das Weibliche.",
        slideNumber: "41"
    },
    {
        arabic: "يا مَنْ فيِ الْبَرِّ وَالْبَحْرِ سَبيلُهُ يا مَنْ فِي الاْفاقِ اياتُهُ يا مَنْ فِي الاْياتِ بُرْهانُهُ",
        german: "o Jener, Dem zu Land und zu Wasser Wege offen stehen, o Jener, Dessen Zeichen an den Horizonten sind, o Jener, Dessen Beweis in den Zeichen liegt,",
        slideNumber: "42"
    },
    {
        arabic: "يا مَنْ فِي الْمَماتِ قُدْرَتُهُ يا مَنْ فِي الْقُبُورِ عِبْرَتُهُ يا مَنْ فِي الْقِيامَةِ مُلْكُهُ",
        german: "o Jener, Dessen Macht sich im Tode zeigt, o Jener, Dessen Lehre sich in den Gräbern zeigt, o Jener, Dessen Herrschaft sich in der Auferstehung zeigt,",
        slideNumber: "42"
    },
    {
        arabic: "يا مَنْ فِي الْحِسابِ هَيْبَتُهُ يا مَنْ فِي الْميزانِ قَضاؤُهُ يا مَنْ فِي الْجَنَّةِ ثَوابُهُ يا مَنْ فِي النّارِ عِقابُهُ",
        german: "o Jener, Dessen Ehrfurchtgebietung sich in der Rechenschaft zeigt, o Jener, Dessen Urteil sich auf der Waage zeigt, o Jener, Dessen Belohnung sich im Paradies zeigt, o Jener, Dessen Bestrafung sich in der Feuer zeigt.",
        slideNumber: "42"
    },
    {
        arabic: "يا مَنْ اِلَيْهِ يَهْرَبُ الْخائِفُونَ يا مَنْ اِلَيْهِ يَفْزَعُ الْمُذْنِبُونَ يا مَنْ اِلَيْهِ يَقْصِدُ الْمُنيبُونَ",
        german: "o Jener, zu Dem die Verängstigten fliehen, o Jener, bei dem die Sünder Zuflucht suchen, o Jener, an Den sich die Bereuenden wenden,",
        slideNumber: "43"
    },
    {
        arabic: "يا مَنْ اِلَيْهِ يَرْغَبُ الزّاهِدُونَ يا مَنْ اِلَيْهِ يَلْجَأُ الْمُتَحَيِّرُونَ يا مَنْ بِهِ يَسْتَأْنِسُ الْمُريدُونَ",
        german: "o Jener, den die Welt-Entsagenden begehren, o Jener, zu Dem die Verwirrten fliehen, o Jener, Den diejenigen, die nach Ihm verlangen, vertrauen,",
        slideNumber: "43"
    },
    {
        arabic: "يا مَنْ بِه يَفْتَخِرُ الْمحِبُّونَ يا مَنْ في عَفْوِهِ يَطْمَعُ الْخاطِئُونَ",
        german: "o Jener, auf Den die Liebenden stolz sind, o Jener, Dessen Verzeihung die Fehlerhaften wünschen,",
        slideNumber: "43"
    },
    {
        arabic: "يا مَنْ اِلَيْهِ يَسْكُنُ الْمُوقِنُونَ يا مَنْ عَلَيْهِ يَتَوَكَّلُ الْمُتَوَكِّلُونَ",
        german: "o Jener, bei Dem die mit Gewissheit Ruhe finden, o Jener, auf Den die Vertrauenden vertrauen.",
        slideNumber: "43"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا حَبيبُ يا طَبيبُ يا قَريبُ يا رَقيبُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Geliebter, o Heiler o Naher, o Beobachter",
        slideNumber: "44"
    },
    {
        arabic: "يا حَسيبُ يا مُهيبُ يا مُثيبُ يا مُجيبُ يا خَبيرُ يا نَصِيرُ",
        german: "o Abrechnender, o Ehrfurchtsgebietender, o Belohnender, o Erfüllender o Erfahrener, o Allsehender.",
        slideNumber: "44"
    },
    {
        arabic: "يا اَقَرَبَ مِنْ كُلِّ قَريبٍ يا اَحَبَّ مِنْ كُلِّ حَبيبٍ يا اَبْصَرَ مِنْ كُلِّ بَصيرٍ",
        german: "o Nächster aller Nahen, o Geliebtester aller Geliebten, o Sehendster aller Sehenden,",
        slideNumber: "45"
    },
    {
        arabic: "يا اَخْبَرَ مِنْ كُلِّ خَبيرٍ يا اَشْرَفَ مِنْ كُلِّ شَريفٍ يا اَرْفَعَ مِنْ كُلِّ رَفيعٍ",
        german: "o Erfahrenster aller Erfahrenen, o Ehrenhaftester aller Ehrenhaften, o Hochrangigster aller Hochrangigen,",
        slideNumber: "45"
    },
    {
        arabic: "يا اَقْوى مِنْ كُلِّ قَوِيٍّ يا اَغْنى مِنْ كُلِّ غَنِيٍّ يا اَجْوَدَ مِنْ كُلِّ جَوادٍ يا اَرْاَفَ مِنْ كُلِّ رَؤوُفٍ",
        german: "o Kraftvollster aller Kraftvollen, o Reichster aller Reichen, o Freigebigster aller Freigebigen, o Erbarmendster aller Erbarmenden.",
        slideNumber: "45"
    },
    {
        arabic: "يا غالِباً غَيْرَ مَغْلُوبٍ يا صانِعاً غَيْرَ مَصْنُوعٍ يا خالِقاً غَيْرَ مَخْلُوقٍ",
        german: "o Sieger ohne Niederlage, o Erschaffer ohne erschaffen zu sein, o Schöpfer ohne geschöpft worden zu sein,",
        slideNumber: "46"
    },
    {
        arabic: "يا مالِكاً غَيْرَ مَمْلُوكٍ يا قاهِراً غَيْرَ مَقْهُورٍ يا رافِعاً غَيْرَ مَرْفُوعٍ",
        german: "o Besitzer, ohne Eigentum zu sein, o Bezwinger, ohne bezwungen zu werden, o Erhöhender, ohne erhöht zu werden,",
        slideNumber: "46"
    },
    {
        arabic: "يا حافِظاً غَيْرَ مَحْفُوظٍ يا ناصِراً غَيْرَ مَنْصُورٍ",
        german: "o Bewahrer, ohne bewahrt zu werden, o Unterstützer, ohne unterstützt zu werden,",
        slideNumber: "46"
    },
    {
        arabic: "يا شاهِداً غَيْرَ غائِبٍ يا قَريباً غَيْرَ بَعيدٍ",
        german: "o Zeuge, ohne abwesend zu sein, o Naher, ohne fern zu sein.",
        slideNumber: "46"
    },
    {
        arabic: "يا نُورَ النُّورِ يا مُنَوِّرَ النُّورِ يا خالِقَ النُّورِ",
        german: "o Licht des Lichtes, o Erleuchtender des Lichtes, o Schöpfer des Lichtes,",
        slideNumber: "47"
    },
    {
        arabic: "يا مُدَبِّرَ النُّورِ يا مُقَدِّرَ النُّورِ يا نُورَ كُلِّ نُورٍ",
        german: "o Gestalter des Lichtes, o Abschätzer des Lichtes, o Licht jedes Lichtes,",
        slideNumber: "47"
    },
    {
        arabic: "يا نُوراً قَبْلَ كُلِّ نُورٍ يا نُوراً بَعْدَ كُلِّ نُورٍ",
        german: "o Licht, das vor jedem Licht da war, o Licht, das nach jedem Licht da sein wird,",
        slideNumber: "47"
    },
    {
        arabic: "يا نُوراً فَوْقَ كُلِّ نُورٍ يا نُوراً لَيْسَ كَمِثْلِهِ نُورٌ",
        german: "o Licht, das über allen Lichtern steht, o Licht, dem kein Licht ebenbürtig ist.",
        slideNumber: "47"
    },
    {
        arabic: "يا مَنْ عَطاؤُهُ شَريفٌ يا مَنْ فِعْلُهُ لَطيفٌ يا مَنْ لُطْفُهُ مُقيمٌ",
        german: "o Jener, Dessen Gaben ehrenhaft sind, o Jener, Dessen Handeln nachsichtig ist, o Jener, Dessen Nachsicht beständig ist,",
        slideNumber: "48"
    },
    {
        arabic: "يا مَنْ اِحْسانُهُ قَديمٌ يا مَنْ قَوْلُهُ حَقٌّ يا مَنْ وَعْدُهُ صِدْقٌ",
        german: "o Jener, Dessen Wohltätigkeit von jeher bestehend ist, o Jener, Dessen Wort die Wahrheit ist, o Jener, Dessen Versprechen aufrichtig ist,",
        slideNumber: "48"
    },
    {
        arabic: "يا مَنْ عَفْوُهُ فَضْلٌ يا مَنْ عَذابُهُ عَدْلٌ",
        german: "o Jener, Dessen Vergebung Huld ist, o Jener, Dessen Bestrafung gerecht ist,",
        slideNumber: "48"
    },
    {
        arabic: "يا مَنْ ذِكْرُهُ حُلْوٌ يا مَنْ فَضْلُهُ عَميمٌ",
        german: "o Jener, Dessen Erwähnung süß ist, o Jener, Dessen Huld umfassend ist.",
        slideNumber: "48"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُسَهِّلُ يا مُفَصِّلُ يا مُبَدِّلُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Erleichterer, o Verdeutlicher, o Verwandler,",
        slideNumber: "49"
    },
    {
        arabic: "يا مُذَلِّلُ يا مُنَزِّلُ يا مُنَوِّلُ يا مُفْضِلُ يا مُجْزِلُ يا مُمْهِلُ يا مُجْمِلُ",
        german: "o Demütigender, o Herabsender, o Verschaffer, o Huldvoller, o Freigiebiger, o Verschonender, o Verleiher von Schönheit.",
        slideNumber: "49"
    },
    {
        arabic: "يا مَنْ يَرى وَلا يُرى يا مَنْ يَخْلُقُ وَلا يُخْلَقُ يا مَنْ يَهْدي وَلا يُهْدى",
        german: "o Jener, Der sieht, Er aber nicht sichtbar ist, o Jener, der erschafft, Er aber nicht erschaffen ist, o Jener, Der den rechten Weg weist, Dem aber nicht der Weg gewiesen wird,",
        slideNumber: "50"
    },
    {
        arabic: "يا مَنْ يُحْيي وَلا يُحْيا يا مَنْ يَسْأَلُ وَلا يُسْأَلُ يا مَنْ يُطْعِمُ وَلا يُطْعَمُ",
        german: "o jener, Der zum Leben erweckt, Er aber nicht zum Leben erweckt wird, o Jener, Der fragt, Er aber nicht befragt wird, o Jener, Der speist, Er aber nicht gespeist wird,",
        slideNumber: "50"
    },
    {
        arabic: "يا مَنْ يُجيرُ وَلا يُجارُ عَلَيْهِ يا مَنْ يَقْضي وَلا يُقْضى عَلَيْهِ",
        german: "o Jener, Der Schutz gebietet, vor Dem es aber keinen Schutz gibt, o Jener, Der richtet, über Den aber nicht gerichtet wird,",
        slideNumber: "50"
    },
    {
        arabic: "يا مَنْ يَحْكُمُ وَلا يُحْكَمُ عَلَيْهِ يا مَنْ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُنْ لَهُ كُفُواً اَحَدٌ",
        german: "o Jener, Der urteilt, über Ihn aber nicht geurteilt wird, o Jener, Der nicht zeugt und nicht gezeugt worden ist, und Ihm ebenbürtig ist keiner.",
        slideNumber: "50"
    },
    {
        arabic: "يا نِعْمَ الْحَسيبُ يا نِعْمَ الطَّبيبُ يا نِعْمَ الرَّقيبُ يا نِعْمَ الْقَريبُ يا نِعْمَ الْمـٌجيبُ",
        german: "o vortrefflichster Abrechnender, o vortrefflichster Heiler, o vortrefflichster Beobachter, o vortrefflichster Naher, o vortrefflichster Erfüllender,",
        slideNumber: "51"
    },
    {
        arabic: "يا نِعْمَ الْحَبيبُ يا نِعْمَ الْكَفيلُ يا نِعْمَ الَوْكيلُ يا نِعْمَ الْمَوْلى يا نِعْمَ النَّصيرُ",
        german: "o vortrefflichster Geliebter, o vortrefflichster Garant, o vortrefflichster Treuhänder, o vortrefflichster Gebieter, o vortrefflicher Beisteher.",
        slideNumber: "51"
    },
    {
        arabic: "يا سُرُورَ الْعارِفينَ يا مُنَى الْمحِبّينَ يا اَنيسَ الْمُريدينَ يا حَبيبَ التَّوّابينَ",
        german: "o Freude der Erkennenden, o Endwunsch der Liebenden, o Vertrauter der Anstrebenden, o Geliebter der Reumütigen,",
        slideNumber: "52"
    },
    {
        arabic: "يا رازِقَ الْمُقِلّينَ يا رَجاءَ الْمُذْنِبينَ يا قُرَّةَ عَيْنِ الْعابِدينَ يا مُنَفِّسُ عَنِ الْمَكْرُوبينَ",
        german: "o Ernährer der Besitzlosen, o Hoffnung der Sünder, o Augentrost der Anbetenden, o Erleichternder der Besorgten,",
        slideNumber: "52"
    },
    {
        arabic: "يا مُفَرِّجُ عَنِ الْمَغْمُومينَ يا اِلـهَ الاْوَّلينَ وَالآخِرينَ",
        german: "o Erlöser der Bekümmerten, o Gott der Ersten und der Letzten.",
        slideNumber: "52"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا رَبَّنا يا اِلهَنا يا سَيِّدَنا يا مَوْلانا",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o unser Herr, o unser Gott, o unser Meister, o unser Gebieter,",
        slideNumber: "53"
    },
    {
        arabic: "يا ناصِرَنا يا حافِظَنا يا دَليلَنا يا مُعينَنا يا حَبيبَنا يا طَبيبَنا",
        german: "o unser Unterstützer, o unser Behüter, o unser Wegweiser, o unser Helfer, o unser Liebling, o unser Heiler.",
        slideNumber: "53"
    },
    {
        arabic: "يا رَبَّ النَّبيّينَ وَالاْبْرارِ يا رَبَّ الصِّدّيقينَ وَالاْخْيارِ يا رَبَّ الْجَنَّةِ وَالنّارِ",
        german: "o Herr der Propheten und der Rechtschaffenen, o Herr der Wahrheitsliebenden und der Auserwählten, o Herr des Paradieses und der Hölle",
        slideNumber: "54"
    },
    {
        arabic: "يا رَبَّ الصِّغارِ وَالْكِبارِ يا رَبَّ الْحُبُوبِ وَالِّثمارِ يا رَبَّ الاْنْهارِ وَالاْشْجار",
        german: "o Herr der Kleinen und der Großen, o Herr der Samenkörner und der Früchte, o Herr der Flüsse und der Bäume",
        slideNumber: "54"
    },
    {
        arabic: "يا رَبَّ الصَّحاري وَالْقِفارِ يا رَبَّ الْبَراري وَالْبِحار",
        german: "o Herr der Wüsten und der Steppen, o Herr des Festlandes und der Meere,",
        slideNumber: "54"
    },
    {
        arabic: "يا رَبَّ اللَّيْلِ وَالنَّهارِ يا رَبَّ الاْعْلانِ وَالاْسْرارِ",
        german: "o Herr der Nacht und des Tages, o Herr des Offengelegten und des Geheimen.",
        slideNumber: "54"
    },
    {
        arabic: "يا مَنْ نَفَذَ في كُلِّ شَيْءٍ اَمْرُهُ يا مَنْ لَحِقَ بِكُلِّ شَيْءٍ عِلْمُهُ يا مَنْ بَلَغَتْ اِلى كُلِّ شَيْءٍ قُدْرَتُهُ",
        german: "o Jener, Dessen Befehl alles unterliegt, o Jener, Dessen Wissen alles umfasst, o Jener, Dessen Macht an alles heranreicht,",
        slideNumber: "55"
    },
    {
        arabic: "يا مَنْ لا تُحْصِي الْعِبادُ نِعَمَهُ يا مَنْ لا تَبْلُغُ الْخَلائِقُ شُكْرَهُ يا مَنْ لا تُدْرِكُ الاْفْهامُ جَلالَهُ",
        german: "o Jener, Dessen Gunst die Diener nicht ermessen können, o Jener, Dessen Dank die Geschöpfe nicht erlangen können, o Jener, Dessen Pracht das Begriffsvermögen nicht erfassen kann,",
        slideNumber: "55"
    },
    {
        arabic: "يا مَنْ لا تَرُدُّ الْعِبادُ قَضاءَهُ يا مَنْ لا مُلْكَ إلاّ مُلْكُهُ يا مَنْ لا عَطاءَ إلاّ عَطاؤُهُ",
        german: "o Jener, Dessen Richtspruch die Diener nicht abwenden können, o Jener, außer Dessen Herrschaft es keine Herrschaft gibt, o Jener, außer Dessen Gaben es keine Gaben gibt.",
        slideNumber: "55"
    },
    {
        arabic: "يا مَنْ لَهُ الْمَثَلُ الاْعْلى يا مَنْ لَهُ الصِّفاتُ الْعُلْيا يا مَنْ لَهُ الاْخِرَةُ وَالاْولى",
        german: "o Jener, Dem die höchsten Ideale gehören, o Jener, Dem die höchsten Eigenschaften gehören, o Jener, Dem das Jenseits und das Diesseits gehören,",
        slideNumber: "56"
    },
    {
        arabic: "يا مَنْ لَهُ الْجَنَّةُ الْمَأوى يا مَنْ لَهُ الآياتُ الْكُبْرى يا مَنْ لَهُ الاْسْماءُ الْحُسْنى",
        german: "o Jener, Dem die Behausungen des Paradieses gehören, o Jener, Dem die größten Zeichen gehören, o Jener, Dem die schönsten Namen gehören,",
        slideNumber: "56"
    },
    {
        arabic: "يا مَنْ لَهُ الْحُكْمُ وَالْقَضاءُ يا مَنْ لَهُ الْهَواءُ وَالْفَضاءُ يا مَنْ لَهُ الْعَرْشُ وَالثَّرى يا مَنْ لَهُ السَّماواتُ الْعُلى",
        german: "o Jener, Dem das Urteil und der Richtspruch gehören, o Jener, Dem die Atmosphäre und der Weltraum gehören, o Jener, Dem der Thron und die Erde gehören, o Jener, Dem die höchsten Himmel gehören.",
        slideNumber: "56"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا عَفُوُّ يا غَفُورُ يا صَبُورُ يا شَكُورُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Vergebender, o Verzeihender, o Geduldiger, o Dankbarer,",
        slideNumber: "57"
    },
    {
        arabic: "يا رَؤوفُ يا عَطُوفُ يا مَسْؤولُ يا وَدُودُ يا سُبُّوحُ يا قُدُّوسُ",
        german: "o Gnädiger, o Nachsichtiger, o Verantwortlicher, o Liebevoller, o Lobgepriesenster, o Heiligster.",
        slideNumber: "57"
    },
    {
        arabic: "يا مَنْ فِي السَّماءِ عَظَمَتُهُ يا مَنْ فِي الاْرْضِ آياتُهُ يا مَنْ في كُلِّ شَيْءٍ دَلائِلُهُ",
        german: "o Jener, Dessen Gewaltigkeit im Himmel offenbar wird, o Jener, Dessen Zeichen auf der Erde sind, o Jener, Dessen Beweise in allem offenbar sind,",
        slideNumber: "58"
    },
    {
        arabic: "يا مَنْ فِي الْبِحارِ عَجائِبُهُ يا مَنْ فِي الْجِبالِ خَزائِنُهُ يا مَنْ يَبْدَأُ الْخَلْقَ ثُمَّ يُعيدُهُ",
        german: "o Jener, Dessen Wunder in den Meeren sind, o Jener, Dessen Schatztruhen in den Bergen sind, o Jener, Der die Schöpfung erschafft und sie dann zurückkehren lässt,",
        slideNumber: "58"
    },
    {
        arabic: "يا مَنْ اِلَيْهِ يَرْجِـعُ الاْمْرُ كُلُّهُ يا مَنْ اَظْهَرَ في كُلِّ شَيْءٍ لُطْفَهُ",
        german: "o Jener, auf Den die ganze Befehlsgewalt zurückgeht, o Jener, Dessen Nachsicht sich in allem zeigt,",
        slideNumber: "58"
    },
    {
        arabic: "يا مَنْ اَحْسَنَ كُلَّ شَيْءٍ خَلْقَهُ يا مَنْ تَصَرَّفَ فِي الْخَلائِقِ قُدْرَتُهُ",
        german: "o Jener, Der alles in seiner Schöpfung schön gemacht hat, o Jener, Dessen Macht frei über die Geschöpfe verfügt.",
        slideNumber: "58"
    },
    {
        arabic: "يا حَبيبَ مَنْ لا حَبيبَ لَهُ يا طَبيبَ مَنْ لا طَبيبَ لَهُ يا مُجيبَ مَنْ لا مُجيبَ لَهُ",
        german: "o Geliebter dessen, der keinen Geliebten hat, o Heiler dessen, der keinen Heiler hat, o Erfüllender dessen, der keinen Erfüllenden hat,",
        slideNumber: "59"
    },
    {
        arabic: "يا شَفيقَ مَنْ لا شَفيقَ لَهُ يا رَفيقَ مَنْ لا رَفيقَ لَهُ يا مُغيثَ مَن لا مُغيثَ لَهُ",
        german: "o Mitleidiger dessen, der keinen Mitleidigen hat, o Begleiter dessen, der keinen Begleiter hat, o Retter dessen, der keinen Retter hat,",
        slideNumber: "59"
    },
    {
        arabic: "يا دَليلَ مَنْ لا دَليلَ لَهُ يا اَنيسَ مَنْ لا اَنيسَ لَهُ",
        german: "o Wegweiser dessen, der keinen Wegweiser hat, o Tröster dessen, der keinen Tröster hat,",
        slideNumber: "59"
    },
    {
        arabic: "يا راحِمَ مَنْ لا راحِمَ لَهُ يا صاحِبَ مَنْ لا صاحِبَ لَهُ",
        german: "o Erbarmer dessen, der keinen Erbarmer hat, o Gefährte dessen, der keinen Gefährten hat.",
        slideNumber: "59"
    },
    {
        arabic: "يا كافِيَ مَنِ اسْتَكْفاهُ يا هادِيَ مَنِ اسْتَهْداهُ يا كالِىءَ مَنِ اسْتَكْلاهُ",
        german: "o Genügender dessen, der Ihn um Genüge bittet, o Wegweiser dessen, der Ihn um Wegweisung bittet, o Beschützer dessen, der Ihn um Schutz bittet,",
        slideNumber: "60"
    },
    {
        arabic: "يا راعِيَ مَنِ اسْتَرْعاهُ يا شافِيَ مَنِ اسْتَشْفاهُ يا قاضِيَ مَنِ اسْتَقْضاهُ",
        german: "o Behüter dessen, der Ihn um Behütung bittet, o Heiler dessen, der Ihn um Heilung bittet, o Richter dessen, der Ihn um Richtspruch bittet",
        slideNumber: "60"
    },
    {
        arabic: "يا مُغْنِيَ مَنِ اسْتَغْناهُ يا مُوفِيَ مَنِ اسْتَوْفاهُ يا مُقَوِّيَ مَنِ اسْتَقْواهُ يا وَلِيَّ مَنِ اسْتَوْلاهُ",
        german: "o Bereichernder dessen, der Ihn um Reichtum bittet, o reich Beschenkender dessen, der Ihn um reiche Schenkung bittet, o Stärkender dessen, der Ihn um Stärkung bittet, o Beistand dessen, der Ihn um Beistand bittet.",
        slideNumber: "60"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا خالِقُ يا رازِقُ يا ناطِقُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Schöpfer, o Versorger, o Erlassender,",
        slideNumber: "61"
    },
    {
        arabic: "يا صادِقُ يا فالِقُ يا فارِقُ يا فاتِقُ يا راتِقُ يا سابِقُ يا سامِقُ",
        german: "o Wahrhaftiger, o Aufspaltender, o Unterscheider, o Trennender, o Aufreißender, o Vorangehender, o Hochragender.",
        slideNumber: "61"
    },
    {
        arabic: "يا مَنْ يُقَلِّبُ اللَّيْلَ وَالنَّهارَ يا مَنْ جَعَلَ الظُّلُماتِ وَالأَنْوارَ يا مَنْ خَلَقَ الظِّلَّ وَالْحَرُورَ",
        german: "o Jener, Der die Nacht und den Tag einander abwechseln lässt, o Jener, Der die Dunkelheit und das Licht erschuf, o Jener, Der die Schatten und die Hitze hervorbrachte,",
        slideNumber: "62"
    },
    {
        arabic: "يا مَنْ سَخَّرَ الشَّمْسَ وَالْقَمَرَ يا مَنْ قَدَّرَ الْخَيْرَ وَالشَّرَّ يا مَنْ خَلَقَ الْمَوْتَ وَالْحَياةَ",
        german: "o Jener, Der die Sonne und den Mond dienstbar machte, o Jener, Der das Gute und das Schlechte bemessen hat, o Jener, Der den Tod und das Leben erschuf,",
        slideNumber: "62"
    },
    {
        arabic: "يا مَنْ لَهُ الْخَلْقُ وَالاْمْرُ يا مَنْ لَمْ يَتَّخِذْ صاحِبَةً وَلا وَلَداً",
        german: "o Jener, Dem die Schöpfung und die Befehlsgewalt gehören, o Jener, Der Sich weder Gefährtin noch ein Kind nimmt,",
        slideNumber: "62"
    },
    {
        arabic: "يا مَنْ لَيْسَ لَهُ شَريكٌ في الْمُلْكِ يا مَنْ لَمْ يَكُنْ لَهُ وَلِيٌّ مِنَ الذُّلِّ",
        german: "o Jener, Der keinen Partner bei der Herrschaft hat, o Jener, Der keinen Gebieter hat, der Ihn vor Demütigung bewahrt.",
        slideNumber: "62"
    },
    {
        arabic: "يا مَنْ يَعْلَمُ مُرادَ الْمُريدينَ يا مَنْ يَعْلَمُ ضَميرَ الصّامِتينَ يا مَنْ يَسْمَعُ اَنينَ الْواهِنينَ",
        german: "o Jener, Der das Ziel der Anstrebenden kennt, o Jener, Der das Innere der Schweigenden kennt, o Jener, Der das Leiden der Geschwächten hört,",
        slideNumber: "63"
    },
    {
        arabic: "يا مَنْ يَرى بُكاءَ الْخائِفينَ يا مَنْ يَمْلِكُ حَوائِجَ السّائِلينَ يا مَنْ يَقْبَلُ عُذْرَ التّائِبينَ",
        german: "o Jener, Der das Weinen der Verängstigten sieht, o Jener, Der das Anliegen der Bittenden besitzt, o Jener, Der die Entschuldigung der Reumütigen annimmt,",
        slideNumber: "63"
    },
    {
        arabic: "يا مَنْ لا يُصْلِحُ عَمَلَ الْمُفْسِدينَ يا مَنْ لا يُضيعُ اَجْرَ الْمـٌحْسِنينَ",
        german: "o Jener, Der die Taten der Verderber nicht gelingen lässt, o Jener, Der die Werke der Rechtschaffenen nicht verkommen lässt,",
        slideNumber: "63"
    },
    {
        arabic: "يا مَنْ لا يَبْعُدُ عَنْ قُلُوبِ الْعارِفينَ يا اَجْوَدَ الاْجْودينَ",
        german: "o Jener, Der sich von den Herzen der Erkennenden nicht entfernt, o Großzügigster der Großzügigen.",
        slideNumber: "63"
    },
    {
        arabic: "يا دائِمَ الْبَقاءِ يا سامِعَ الدُّعاءِ يا واسِعَ الْعَطاءِ يا غافِرَ الْخَطاءِ",
        german: "o Dessen Ewigkeit immer währt, o Erhörer des Bittgebets, o Dessen Gaben reichlich sind, o Verzeihender der Fehler,",
        slideNumber: "64"
    },
    {
        arabic: "يا بَديعَ السَّماءِ يا حَسَنَ الْبَلاءِ يا جَميلَ الثَّناءِ يا قَديمَ السَّناءِ",
        german: "o Schöpfer des Himmels, o Dessen Prüfung gut ist, o Dessen Lob schön ist, o Dessen Glanz von je her besteht,",
        slideNumber: "64"
    },
    {
        arabic: "يا كَثيرَ الْوَفاءِ يا شَريفَ الْجَزاء",
        german: "o Dessen Treue groß ist, o Dessen Belohnung ehrenhaft ist.",
        slideNumber: "64"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا سَتّارُ يا غَفّارُ يا قَهّارُ",
        german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Verhüller, o Verzeihender, o Bezwinger, o Allgewaltiger,",
        slideNumber: "65"
    },
    {
        arabic: "يا جَبّارُ يا صَبّارُ يا بارُّ يا مُخْتارُ يا فَتّاحُ يا نَفّاحُ يا مُرْتاحُ",
        german: "o Langmütiger, o Gütiger, o Auserwählender, o Eröffnender, o Beschenkender, o Zufriedener.",
        slideNumber: "65"
    },
    {
        arabic: "يا مَنْ خَلَقَني وَسَوّاني يا مَنْ رَزَقَني وَرَبّاني يا مَنْ اَطْعَمَني وَسَقاني",
        german: "o Jener, Der mich erschaffen und geformt hat, o Jener, Der mich versorgt und aufgezogen hat o Jener, Der mich mit Speisen und Getränken versorgt hat,",
        slideNumber: "66"
    },
    {
        arabic: "يا مَنْ قَرَّبَني وَ اَدْناني يا مَنْ عَصَمَني وَكَفاني يا مَنْ حَفِظَني وَكَلاني",
        german: "o Jener, Der mich angenähert und herangerückt hat, o Jener, Der mich beschützt und Genüge getan hat, o Jener, Der mich behütet und bewahrt hat,",
        slideNumber: "66"
    },
    {
        arabic: "يا مَنْ اَعَزَّني وَاَغْناني يا مَنْ وَفَّقَني وَهَداني يا مَنْ آنَسَني وَآوَاني يا مَنْ اَماتَني وَاَحْياني",
        german: "o Jener, Der mich gestärkt und bereichert hat, o Jener, Der mir Erfolg geschenkt und rechtgeleitet hat, o Jener, Der mich getröstet und mir Unterkunft gewährt hat, o Jener, Der mich sterben Und wieder leben lässt.",
        slideNumber: "66"
    },
    {
        arabic: "يا مَنْ يُحِقُّ الْحَقَّ بِكَلِماتِهِ يا مَنْ يَقْبَلُ التَّوْبَةَ عَنْ عِبادِهِ يا مَنْ يَحُولُ بَيْنَ الْمَرْءِ وَقَلْبِهِ",
        german: "o Jener, Der mit Seinen Worten die Wahrheit bestätigt, o Jener, Der die Reue Seiner Diener annimmt, o Jener, Der zwischen dem Menschen und seinem Herzen steht,",
        slideNumber: "67"
    },
    {
        arabic: "يا مَنْ لا تَنْفَعُ الشَّفاعَةُ إلاّ بِاِذْنِهِ يا مَنْ هُوَ اَعْلَمُ بِمَنْ ضَلَّ عَنْ سَبيلِهِ يا مَنْ لا مُعَقِّبَ لِحُكْمِهِ",
        german: "o Jener, ohne Dessen Erlaubnis keine Fürsprache Erfolg hat, o Jener, Der am besten weiß über jene, die von Seinem Weg abgewichen sind, o Jener, Dessen Urteil nicht zurückgewiesen werden kann",
        slideNumber: "67"
    },
    {
        arabic: "يا مَنْ لا رادَّ لِقَضائِهِ يا مَنِ انْقادَ كُلُّ شَيْءٍ لأَمْرِهِ",
        german: "o Jener, Dessen Richtspruch nicht in Frage gestellt werden kann, o Jener, Dessen Befehl alles unterlegen ist,",
        slideNumber: "67"
    },
    {
        arabic: "يا مَنِ السَّماواتُ مَطْوِيّاتٌ بِيَمينِهِ يا مَنْ يُرْسِلُ الرِّياحَ بُشْراً بَيْنَ يَدَيْ رَحْمَتِهِ",
        german: "o Jener, in Dessen Rechter die Himmel zusammengelegt sind, o Jener, Der die Winde als Vorboten Seiner Gnade bei Ihm schickt.",
        slideNumber: "67"
    },
    {
        arabic: "يا مَنْ جَعَلَ الاْرْضَ مِهاداً يا مَنْ جَعَلَ الْجِبالَ اَوْتاداً يا مَنْ جَعَلَ الشَّمْسَ سِراجاً",
        german: "o Jener, Der die Erde ausgewogen errichtet hat, o Jener, Der die Berge zu Pflöcken errichtet hat, o Jener, Der die Sonne zu einer Leuchte errichtet hat,",
        slideNumber: "68"
    },
    {
        arabic: "يا مَنْ جَعَلَ الْقَمَرَ نُوراً يا مَنْ جَعَلَ اللَّيْلَ لِباساً يا مَنْ جَعَلَ النَّهارَ مَعاشاً",
        german: "o Jener, Der den Mond zum Licht errichtet hat, o Jener, Der die Nacht zu einem Gewand errichtet hat, o Jener, Der den Tag zum Zusammenleben errichtet hat,",
        slideNumber: "68"
    },
    {
        arabic: "يا مَنْ جَعَلَ النَّوْمَ سُباتاً يا مَنْ جَعَلَ السَّمآءَ بِناءً يا مَنْ جَعَلَ الاْشْياءَ اَزْواجاً يا مَنْ جَعَلَ النّارَ مِرْصاداً",
        german: "o Jener, Der den Schlaf zum Ausruhen errichtet hat, o Jener, Der den Himmel zum Erbauten errichtet hat, o Jener, Der die Dinge als Paare errichtet hat, o Jener, Der das Feuer zu einer Wacht errichtet hat.",
        slideNumber: "68"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا سَميعُ يا شَفيعُ يا رَفيعُ",
        german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Allhörender, o Fürsprecher, o Angesehener,",
        slideNumber: "69"
    },
    {
        arabic: "يا مَنيعُ يا سَريعُ يا بَديعُ يا كَبيرُ يا قَديرُ يا خَبيرُ يا مُجيرُ",
        german: "o Unüberwindlicher, o Zügiger, o Glanzvoller, o Großer, o Mächtiger o Kundiger, o Schutzgewährender.",
        slideNumber: "69"
    },
    {
        arabic: "يا حَيّاً قَبْلَ كُلِّ حَيٍّ يا حَيّاً بَعْدَ كُلِّ حَيٍّ يا حَيُّ الَّذي لَيْسَ كَمِثْلِهِ حَيٌّ",
        german: "o Lebender vor allen Lebewesen, o Lebender nach allen Lebewesen, o Lebender, Dem kein Lebewesen gleicht,",
        slideNumber: "70"
    },
    {
        arabic: "يا حَيُّ الَّذي لا يُشارِكُهُ حَيٌّ يا حَيُّ الَّذي لا يَحْتاجُ اِلى حَيٍّ يا حَيُّ الَّذي يُميتُ كُلَّ حَيٍّ",
        german: "o Lebender, Der kein Lebewesen als Partner hat, o Lebender, Der auf kein Lebewesen angewiesen ist, o Lebender, Der alle Lebewesen sterben lässt,",
        slideNumber: "70"
    },
    {
        arabic: "يا حَيُّ الَّذي يَرْزُقُ كُلَّ حَيٍّ يا حَيّاً لَمْ يَرِثِ الْحَياةَ مِنْ حَيٍّ يا حَيُّ الَّذي يُحْيِي الْمَوْتى يا حَيُّ يا قَيُّومُ لا تَأخُذُهُ سِنَةٌ وَلا نَوْمٌ",
        german: "o Lebender, Der alle Lebewesen versorgt, o Lebender, Der das Leben von keinem Lebewesen geerbt bekommen hat, o Lebender, Der die Toten wieder zum Leben erweckt, o Lebender, o Beständiger, Ihn überkommt weder Schlummer noch Schlaf.",
        slideNumber: "70"
    },
    {
        arabic: "يا مَنْ لَهُ ذِكْرٌ لا يُنْسى يا مَنْ لَهُ نُورٌ لا يُطْفَأُ يا مَنْ لَهُ نِعَمٌ لا تُعَدُّ",
        german: "o Jener, Dessen Erwähnung unvergesslich ist, o Jener, Dessen Licht unauslöschlich ist, o Jener, Dessen Gaben unzählbar sind,",
        slideNumber: "71"
    },
    {
        arabic: "يا مَنْ لَهُ مُلْكٌ لا يَزُولُ يا مَنْ لَهُ ثَناءٌ لا يُحْصى يا مَنْ لَهُ جَلالٌ لا يُكَيَّفُ",
        german: "o Jener, Dessen Herrschaft unvergänglich ist, o Jener, Dessen Lob nicht auf zählbar ist, o Jener, Dessen Herrlichkeit unbeschreibbar ist,",
        slideNumber: "71"
    },
    {
        arabic: "يا مَنْ لَهُ كَمالٌ لا يُدْرَكُ يا مَنْ لَهُ قَضاءٌ لا يُرَدُّ يا مَنْ لَهُ صِفاتٌ لا تُبَدَّلُ يا مَنْ لَهُ نُعُوتٌ لا تُغَيَّرُ",
        german: "o Jener, Dessen Vollkommenheit unvorstellbar ist, o Jener, Dessen Urteil nicht zurückzuweisen ist, o Jener, Dessen Eigenschaften unersetzbar sind, o Jener, Dessen Attribute unveränderlich sind.",
        slideNumber: "71"
    },
    {
        arabic: "يا رَبَّ الْعالَمينَ يا مالِكَ يَوْمِ الدّينِ يا غايَةَ الطّالِبينَ",
        german: "o Herr der Welten, o Herrscher des Jüngsten Tages, o Endziel der Anstrebenden,",
        slideNumber: "72"
    },
    {
        arabic: "يا ظَهْرَ اللاّجينَ يا مُدْرِكَ الْهارِبينَ يا مَنْ يُحِبُّ الصّابِرينَ",
        german: "o Rückhalt der Zufluchtsuchenden, o Erfassender der Fliehenden, o Jener, Der die Geduldigen liebt",
        slideNumber: "72"
    },
    {
        arabic: "يا مَنْ يُحِبُّ التَّوّابينَ يا مَنْ يُحِبُّ الْمُتَطَهِّرينَ",
        german: "o Jener, Der die Reumütigen liebt, o Jener, Der die sich Reinigenden liebt,",
        slideNumber: "72"
    },
    {
        arabic: "يا مَنْ يُحِبُّ الْمحْسِنينَ يا مَنْ هُوَ اَعْلَمُ بِالْمُهْتَدينَ",
        german: "o Jener, Der die Wohltätigen liebt, o Jener, Der wissender ist über die Rechtgeleiteten.",
        slideNumber: "72"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا شَفيقُ يا رَفيقُ يا حَفيظُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Erbarmer, o Milder, o Bewahrer,",
        slideNumber: "73"
    },
    {
        arabic: "يا مُحيطُ يا مُقيتُ يا مُغيثُ يا مُعِزُّ يا مُذِلُّ يا مُبْدِئُ يا مُعيدُ",
        german: "o Umfassender, o Ernährer, o Rettungsgewährender o Ehrender, o Demütigender, o Urheber, o Wiederherstellender.",
        slideNumber: "73"
    },
    {
        arabic: "يا مَنْ هُوَ اَحَدٌ بِلا ضِدٍّ يا مَنْ هُوَ فَرْدٌ بِلا نِدٍّ يا مَنْ هُوَ صَمَدٌ بِلا عَيْبٍ",
        german: "o Jener, Der ein Einziger ohne Gegner ist, o Jener, Der ein Einzelner ohne Rivale ist, o Jener, Der ein Unabhängiger ohne Makel ist,",
        slideNumber: "74"
    },
    {
        arabic: "يا مَنْ هُوَ وِتْرٌ بِلا كَيْفٍ يا مَنْ هُوَ قاضٍ بِلا حَيْفٍ يا مَنْ هُوَ رَبٌّ بِلا وَزيرٍ",
        german: "o Jener, Der ein unbeschreibbarer Einmaliger ist, o Jener, Der ein Richter ist ohne Ungerechtigkeit, o Jener, Der ein Herr ohne Berater ist,",
        slideNumber: "74"
    },
    {
        arabic: "يا مَنْ هُوَ عَزيزٌ بِلا ذُلٍّ يا مَنْ هُوَ غَنِيٌّ بِلا فَقْرٍ",
        german: "o Jener, Der ein Mächtiger ohne Schwäche ist o Jener, Der reich ist ohne Bedürftigkeit,",
        slideNumber: "74"
    },
    {
        arabic: "يا مَنْ هُوَ مَلِكٌ بِلا عَزْلٍ يا مَنْ هُوَ مَوْصُوفٌ بِلا شَبيهٍ",
        german: "o Jener, Der unabsetzbarer Herrscher ist, o Jener, Der ohne einen Ähnlichen beschrieben wird.",
        slideNumber: "74"
    },
    {
        arabic: "يا مَنْ ذِكْرُهُ شَرَفٌ لِلذّاكِرينَ يا مَنْ شُكْرُهُ فَوْزٌ لِلشّاكِرينَ يا مَنْ حَمْدُهُ عِزٌّ لِلْحامِدينَ",
        german: "o Jener, Dessen Erwähnung Ehre für die Erwähnenden ist, o Jener, Dessen Dank Triumph für die Dankbaren ist, o Jener, Dessen Lob Stärkung für die Lobpreisenden ist,",
        slideNumber: "75"
    },
    {
        arabic: "يا مَنْ طاعَتُهُ نَجاةٌ لِلْمُطيعينَ يا مَنْ بابُهُ مَفْتُوحٌ لِلطّالِبينَ يا مَنْ سَبيلُهُ واضِحٌ لِلْمُنيبينَ",
        german: "o Jener, Dessen Gehorsam Ihm gegenüber für die Gehorsamen Rettung ist, o Jener, Dessen Tür den Wünschenden offen steht, o Jener, Dessen Weg für die Reuenden klar erkennbar ist,",
        slideNumber: "75"
    },
    {
        arabic: "يا مَنْ آياتُهُ بُرْهانٌ لِلنّاظِرينَ يا مَنْ كِتابُهُ تَذْكِرَةٌ لِلْمُتَّقينَ",
        german: "o Jener, Dessen Zeichen den Schauenden Beweis sind, o Jener, Dessen Buch eine Erinnerung für die Frommen ist,",
        slideNumber: "75"
    },
    {
        arabic: "يا مَنْ رِزْقُهُ عُمُومٌ لِلطّائِعينَ وَالْعاصينَ يا مَنْ رَحْمَتُهُ قَريبٌ مِنَ الْمحْسِنينَ",
        german: "o Jener, Dessen Versorgung für die Gehorsamen und die Ungehorsamen ist, o Jener, Dessen Gnade den Wohltätigen nahe ist.",
        slideNumber: "75"
    },
    {
        arabic: "يا مَنْ تَبارَكَ اسْمُهُ يا مَنْ تَعالى جَدُّهُ يا مَنْ لا اِلـهَ غَيْرُهُ",
        german: "o Jener, Dessen Name gesegnet ist, o Jener, Dessen Stellung gehoben ist, o Jener, außer Dem es keine Gottheit gibt,",
        slideNumber: "76"
    },
    {
        arabic: "يا مَنْ جَلَّ ثَناؤُهُ يا مَنْ تَقَدَّسَتَ اَسْماؤُهُ يا مَنْ يَدُومُ بَقاؤُهُ",
        german: "o Jener, Dessen Lobpreisung erhaben ist, o Jener, Dessen Namen heilig sind, o Jener, Dessen Beständigkeit ewig währt",
        slideNumber: "76"
    },
    {
        arabic: "يا مَنِ الْعَظَمَةُ بَهاؤُهُ يا مَنِ الْكِبْرِياءُ رِداؤُهُ يا مَنْ لا تُحْصى الاؤُهُ يا مَنْ لا تُعَدُّ نَعْماؤُه",
        german: "o Jener, Dessen Größe Sein Glanz ist, o Jener, Dessen Herrlichkeit sein Gewand ist, o Jener, Dessen Wohltaten unermesslich sind, o Jener, Dessen Gaben unzählbar sind.",
        slideNumber: "76"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُعينُ يا اَمينُ يا مُبينُ يا مَتينُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Helfer, o Vertrauenswürdiger, o Deutlicher, o Starker,",
        slideNumber: "77"
    },
    {
        arabic: "يا مَكينُ يا رَشيدُ يا حَميدُ يا مَجيدُ يا شَديدُ يا شَهيدُ",
        german: "o Gewalthabender, o Bedachter, o Lobenswerter, o Ruhmreicher, o Strenger, o Zeuge.",
        slideNumber: "77"
    },
    {
        arabic: "يا ذَا الْعَرْشِ الْمجيدِ يا ذَا الْقَوْلِ السَّديدِ يا ذَا الْفِعْلِ الرَّشيدِ",
        german: "O Dem der ruhmreiche Thron gehört, o Dem die treffende Rede gehört, o Dem die bedachte Handlung gehört,",
        slideNumber: "78"
    },
    {
        arabic: "يا ذَا الْبَطْشِ الشَّديدِ يا ذَا الْوَعْدِ وَالْوَعيدِ يا مَنْ هُوَ الْوَلِيُّ الْحَميدُ",
        german: "o Dem die strenge Gewalt gehört, o Dem das Versprechen und die Drohung gehören, o Der lobenswerter Gebieter ist",
        slideNumber: "78"
    },
    {
        arabic: "يا مَنْ هُوَ فَعّالٌ لِما يُريدُ يا مَنْ هُوَ قَريبٌ غَيْرُ بَعيدٍ",
        german: "o Der das tut, was Er will, o Naher, Der nicht fern ist,",
        slideNumber: "78"
    },
    {
        arabic: "يا مَنْ هُوَ عَلى كُلِّ شَيْءٍ شَهيدٌ يا مَنْ هُوَ لَيْسَ بِظَلاّمٍ لِلْعَبيدِ",
        german: "o Der Zeuge aller Dinge ist, o Der Seinen Dienern gegenüber niemals ungerecht ist.",
        slideNumber: "78"
    },
    {
        arabic: "يا مَنْ لا شَريكَ لَهُ وَلا وَزيرَ يا مَنْ لا شَبيهَ لَهُ وَلا نَظيرَ يا خالِقَ الشَّمْسِ وَالْقَمَرِ الْمُنيرِ",
        german: "o Jener, Der weder Partner noch Berater hat, o Jener, Dem nichts gleich oder ähnlich ist, o Schöpfer der Sonne und des leuchtenden Mondes,",
        slideNumber: "79"
    },
    {
        arabic: "يا مُغْنِيَ الْبائِسِ الْفَقيرِ يا رازِقَ الْطِّفْلِ الصَّغيرِ يا راحِمَ الشَّيْخِ الْكَبيرِ",
        german: "o Der, Der die unglücklichen Armen reich macht, o Versorger des kleinen Kindes, o Erbarmer des alten Menschen,",
        slideNumber: "79"
    },
    {
        arabic: "يا جابِرَ الْعَظْمِ الْكَسيرِ يا عِصْمَةَ الْخآئِفِ الْمُسْتَجيرِ",
        german: "o Einrenkender des gebrochenen Knochens, o Beschützer des ängstlich Hilfesuchenden,",
        slideNumber: "79"
    },
    {
        arabic: "يا مَنْ هُوَ بِعِبادِهِ خَبيرٌ بَصيرٌ يا مَنْ هُوَ عَلى كُلِّ شَيْءٍ قَديرٌ",
        german: "o Jener, Der erfahren und allsehend über Seine Diener ist, o Jener, Der zu allem fähig ist.",
        slideNumber: "79"
    },
    {
        arabic: "يا ذَا الْجُودِ وَالنِّعَمِ يا ذَا الْفَضْلِ وَالْكَرَمِ يا خالِقَ اللَّوْحِ وَالْقَلَمِ",
        german: "Oh, Eigner der Großzügigkeit und der Gaben, o Eigner der Gunst und der Großzügigkeit, o Schöpfer der Tafel und des Stifts,",
        slideNumber: "80"
    },
    {
        arabic: "يا بارِئَ الذَّرِّ وَالنَّسَمِ يا ذَا الْبَأْسِ وَالنِّقَمِ يا مُلْهِمَ الْعَرَبِ وَالْعَجَمِ",
        german: "o Du Schöpfer der Atome und des beseelten Lebens, o Eigner des Peins und der Vergeltung, o Der Araber wie Nichtaraber inspiriert",
        slideNumber: "80"
    },
    {
        arabic: "يا كاشِفَ الضُّرِّ وَالألَمِ يا عالِمَ السِّرِّ وَالْهِمَمِ",
        german: "o Der Schaden und Schmerz beseitigt, o Der Geheimnisse und Absichten kennt,",
        slideNumber: "80"
    },
    {
        arabic: "يا رَبَّ الْبَيْتِ وَالْحَرَمِ يا مَنْ خَلَقَ الاْشياءَ مِنَ الْعَدَمِ",
        german: "o Der Herr des Hauses und der Heiligen Stätte ist, o Der die Dinge aus dem Nichts heraus erschaffen hat.",
        slideNumber: "80"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا فاعِلُ يا جاعِلُ يا قابِلُ",
        german: "Allah unser, Ich flehe Dich mit Deinem Namen an: o Handelnder, o Hervorbringender, o Annehmer,",
        slideNumber: "81"
    },
    {
        arabic: "يا كامِلُ يا فاصِلُ يا واصِلُ يا عادِلُ يا غالِبُ يا طالِبُ يا واهِبُ",
        german: "o Vollkommener, o Aburteilender, o Beschenkender, o Gerechter, o Besiegender, o Verlangender, o Spender.",
        slideNumber: "81"
    },
    {
        arabic: "يا مَنْ اَنْعَمَ بِطَوْلِهِ يا مَنْ اَكْرَمَ بِجُودِهِ يا مَنْ جادَ بِلُطْفِهِ",
        german: "o Jener, Der mit Seiner Macht Wohltaten erwies, o Jener, Der mit Seiner Güte Großzügigkeit erwies, o Jener, Der mit Seiner Nachsicht Güte erwies,",
        slideNumber: "82"
    },
    {
        arabic: "يا مَنْ تَعَزَّزَ بِقُدْرَتِهِ يا مَنْ قَدَّرَ بِحِكْمَتِهِ يا مَنْ حَكَمَ بِتَدْبيرِهِ",
        german: "o Jener, Der mit Seiner Fähigkeit mächtig war, o Jener, Der mit Seiner Weisheit bewertete, o Jener, Der nach Seinen Maßnahmen regierte,",
        slideNumber: "82"
    },
    {
        arabic: "يا مَنْ دَبَّرَ بِعِلْمِهِ يا مَنْ تَجاوَزَ بِحِلْمِهِ يا مَنْ دَنا في عُلُوِّهِ يا مَنْ عَلا في دُنُوِّهِ",
        german: "o Jener, Der nach Seinem Wissen Maßnahmen traf, o Jener, Der mit Seinem Langmut absah, o Jener, Der in Seiner Erhabenheit nah war, o Jener, Der mit Seiner Nähe erhaben war.",
        slideNumber: "82"
    },
    {
        arabic: "يا مَنْ يَخْلُقُ ما يَشاءُ يا مَنْ يَفْعَلُ ما يَشاءُ يا مَنْ يَهْدي مَنْ يَشاءُ",
        german: "o Jener, Der schafft, was Er will, o Jener, Der tut, was Er will, o Jener, Der zum Rechten leitet, wen er will,",
        slideNumber: "83"
    },
    {
        arabic: "يا مَنْ يُضِلُّ مَنْ يَشاءُ يا مَنْ يُعَذِّبُ مَنْ يَشاءُ يا مَنْ يَغْفِرُ لِمَنْ يَشآءُ",
        german: "o Jener, Der irregehen lässt, wen Er will, o Jener, Der bestraft, wen Er will, o Jener, Der verzeiht, wem Er will",
        slideNumber: "83"
    },
    {
        arabic: "يا مَنْ يُعِزُّ مَنْ يَشاءِ يا مَنْ يُذِلُّ مَنْ يَشاءُ",
        german: "o Jener, Der stärkt, wen Er will, o Jener, Der demütigt, wen Er will.",
        slideNumber: "83"
    },
    {
        arabic: "يا مَنْ يُصَوِّرُ فِي الاْرْحامِ ما يَشاءُ يا مَنْ يَخْتَصُّ بِرَحْمَتِهِ مَنْ يَشاءُ",
        german: "o Jener, Der im Mutterleib gestaltet, was Er will, o Jener, Der Sein Erbarmen schenkt, wem Er will.",
        slideNumber: "83"
    },
    {
        arabic: "يا مَنْ لَمْ يَتَّخِذْ صاحِبَةً وَلا وَلَداً يا مَنْ جَعَلَ لِكُلِّ شَيْءٍ قَدْراً يا مَنْ لا يُشْرِكُ في حُكْمِهِ اَحَداً",
        german: "o Jener, Der sich weder Gattin noch Kind nahm, o Jener, Der allen Dingen ein Maß errichtet hat, o Jener, Der an Seiner Herrschaft niemanden teilhaben lässt,",
        slideNumber: "84"
    },
    {
        arabic: "يا مَنْ جَعَلَ الْمَلائِكَةَ رُسُلاً يا مَنْ جَعَلَ فِي السَّماءِ بُرُوجاً يا مَنْ جَعَلَ الاْرْضَ قَراراً",
        german: "o Jener, Der die Engel zu Gesandten errichtet hat, o Jener, Der im Himmel Sternbilder errichtet hat, o Jener, Der die Erde zum festen Wohnsitz errichtet hat,",
        slideNumber: "84"
    },
    {
        arabic: "يا مَنْ خَلَقَ مِنَ الْماءِ بَشَراً يا مَنْ جَعَلَ لِكُلِّ شَيْءٍ اَمَداً",
        german: "o Jener, Der Menschen aus Wasser erschaffen hat, o Jener, Der für alle Dinge eine Frist errichtet hat,",
        slideNumber: "84"
    },
    {
        arabic: "يا مَنْ اَحاطَ بِكُلِّ شَيْءٍ عِلْماً يا مَنْ اَحْصى كُلَّ شَيْءٍ عَدَدا",
        german: "o Jener, Der alles mit Wissen umfasst, o Jener, Der die Anzahl von allem erfasst.",
        slideNumber: "84"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا اَوَّلُ يا آخِرُ يا ظاهِرُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Erster, o Letzter, o Offenbarer,",
        slideNumber: "85"
    },
    {
        arabic: "يا باطِنُ يا بَرُّ يا حَقُّ يا فَرْدُ يا وِتْرُ يا صَمَدُ يا سَرْمَدُ",
        german: "o Unsichtbarer, o Gütiger, o Rechtsschaffner, o Einziger, o Einzelner, o Unabhängiger, o Ewiger.",
        slideNumber: "85"
    },
    {
        arabic: "يا خَيْرَ مَعْرُوفٍ عُرِفَ يا اَفْضَلَ مَعْبُودٍ عُبِدَ يا اَجَلَّ مَشْكُورٍ شُكِرَ",
        german: "o wohltätigster Bekannter, Der bekannt wurde, o gütigster Angebeteter, Der angebetet wurde, o majestätischster Gedankter, Dem gedankt wurde,",
        slideNumber: "86"
    },
    {
        arabic: "يا اَعَزَّ مَذْكُورٍ ذُكِرَ يا اَعْلى مَحْمُودٍ حُمِدَ يا اَقْدَمَ مَوْجُودٍ طُلِبَ",
        german: "o mächtigster Erwähnter, Der erwähnt wurde, o höchster Gelobter, Der gelobt wurde, o ältester Existierender, Der angestrebt wurde,",
        slideNumber: "86"
    },
    {
        arabic: "يا اَرْفَعَ مَوْصُوفٍ وُصِفَ يا اَكْبَرَ مَقْصُودٍ قُصِدَ يا اَكْرَمَ مَسْؤولٍ سُئِلَ يا اَشْرَفَ مَحْبُوبٍ عُلِمَ",
        german: "o angesehenster Beschriebener, Der beschrieben wurde, o größter Erstrebter, Der erstrebt wurde, o großzügigster Gefragter, Der gefragt wurde, o ruhmreichster Geliebter, Der gekannt worden ist.",
        slideNumber: "86"
    },
    {
        arabic: "يا حَبيبَ الْباكينَ يا سَيِّدَ الْمُتَوَكِّلينَ يا هادِيَ الْمُضِلّينَ",
        german: "o Geliebter der Weinenden, o Herr der Vertrauenden, o Rechtleitender der Fehlgeleiteten,",
        slideNumber: "87"
    },
    {
        arabic: "يا وَلِيَّ الْمُؤْمِنينَ يا اَنيسَ الذّاكِرينَ يا مَفْزَعَ الْمَلْهُوفينَ",
        german: "o Gebieter der Gläubigen, o Vertrauter der Erwähnenden, o Zuflucht der Hilfesuchenden,",
        slideNumber: "87"
    },
    {
        arabic: "يا مُنْجِيَ الصّادِقينَ يا اَقْدَرَ الْقادِرينَ يا اَعْلَمَ الْعالِمينَ يا اِلـهَ الْخَلْقِ اَجْمَعينَ",
        german: "o Retter der Wahrhaftigen, o Mächtigster der Mächtigen, o Wissendster der Wissenden, o Gott der Geschöpfe allesamt.",
        slideNumber: "87"
    },
    {
        arabic: "يا مَنْ عَلا فَقَهَرَ يا مَنْ مَلَكَ فَقَدَرَ يا مَنْ بَطَنَ فَخَبَرَ",
        german: "o Jener, Der höher ist und überwältigt hat, o Jener, Der herrscht und mächtig ist, o Jener, Der unsichtbar und erfahren ist,",
        slideNumber: "88"
    },
    {
        arabic: "يا مَنْ عُبِدَ فَشَكَرَ يا مَنْ عُصِيَ فَغَفَرَ يا مَنْ لا تَحْويهِ الْفِكَرُ",
        german: "o Jener, Der angebetet wird und sich bedankt, o Jener, Dem Ungehorsam gezeigt wird und vergibt, o Jener, Der in den Gedanken nicht erfassbar ist,",
        slideNumber: "88"
    },
    {
        arabic: "يا مَنْ لا يُدْرِكُهُ بَصَرٌ يا مَنْ لا يَخْفى عَلَيْهِ اَثَرٌ",
        german: "o Jener, Der für das Sehvermögen nicht erreichbar ist, o Jener, Dem keine Spur verborgen bleibt,",
        slideNumber: "88"
    },
    {
        arabic: "يا رازِقَ الْبَشَرِ يا مُقَدِّرَ كُلِّ قَدَرٍ",
        german: "o Jener, Der die Menschen versorgt, o Jener, Der jedes Maß bemisst.",
        slideNumber: "88"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا حافِظُ يا بارِئُ يا ذارِئُ يا باذِخُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Bewahrer, o Lebenschenkender, o Urheber, o Großzügiger",
        slideNumber: "89"
    },
    {
        arabic: "يا فارِجُ يا فاتِحُ يا كاشِفُ يا ضامِنُ يا امِرُ يا ناهي",
        german: "o Erlöser, o Eröffnender, o Enthüllender, o Bürge, o Befehlender, o Verwehrender.",
        slideNumber: "89"
    },
    {
        arabic: "يا مَنْ لا يَعْلَمُ الْغَيْبَ إلاّ هُوَ يا مَنْ لا يَصْرِفُ السُّوءَ إلاّ هُوَ يا مَنْ لا يَخْلُقُ الْخَلْقَ إلاّ هُوَ",
        german: "o Jener, außer Dem niemand das Verborgene weiß, o Jener, außer Dem niemand das Schlechte abwendet, o Jener, außer Dem niemand die Schöpfung erschafft,",
        slideNumber: "90"
    },
    {
        arabic: "يا مَنْ لا يَغْفِرُ الذَّنْبَ إلاّ هُوَ يا مَنْ لا يُتِمُّ النِّعْمَةَ إلاّ هُوَ يا مَنْ لا يُقَلِّبُ الْقُلُوبَ إلاّ هُوَ",
        german: "o Jener, außer Dem niemand die Sünden verzeiht, o Jener, außer Dem niemand die Wohltaten vollendet, o Jener, außer Dem niemand die Herzen prüft,",
        slideNumber: "90"
    },
    {
        arabic: "يا مَنْ لا يُدَبِّرُ الاْمْرَ إلاّ هُوَ يا مَنْ لا يُنَزِّلُ الْغَيْثَ إلاّ هُوَ",
        german: "o Jener, außer dem niemand die Dinge steuert, o Jener, außer Dem niemand den Regen herabsendet,",
        slideNumber: "90"
    },
    {
        arabic: "يا مَنْ لا يَبْسُطُ الرِّزْقَ إلاّ هُوَ يا مَنْ لا يُحْيِي الْمَوْتى إلاّ هُوَ",
        german: "o Jener, außer Dem niemand die Versorgung verteilt, o Jener, außer Dem niemand die Toten wieder zum Leben erweckt.",
        slideNumber: "90"
    },
    {
        arabic: "يا مُعينَ الْضُعَفاءِ يا صاحِبَ الْغُرَباءِ يا ناصِرَ الاْوْلِياءِ",
        german: "o Unterstützer der Schwachen, o Gefährte der Fremden, o Beistand der Gefolge,",
        slideNumber: "91"
    },
    {
        arabic: "يا قاهِرَ الاْعْداءِ يا رافِعَ السَّماءِ يا اَنيسَ الاْصْفِياءِ",
        german: "o Du Bezwinger der Feinde, o Aufrichter der Himmel, o Gefährte der Auserwählten,",
        slideNumber: "91"
    },
    {
        arabic: "يا حَبيبَ الاْتْقِياءِ يا كَنْزَ الْفُقَراءِ يا اِلـهَ الاْغْنِياءِ يا اَكْرَمَ الْكُرَماءِ",
        german: "o Geliebter der Frommen, o Schatz der Armen, o Gott der Reichen, o Großzügigster der Großzügigen.",
        slideNumber: "91"
    },
    {
        arabic: "يا كافِياً مِنْ كُلِّ شَيْءٍ يا قائِماً عَلى كُلِّ شَيْءٍ يا مَنْ لا يُشْبِهُهُ شَيْءٌ",
        german: "o Du Genügender aller Dinge, o Du Bewahrer aller Dinge, o Jener, dem nichts ähnelt,",
        slideNumber: "92"
    },
    {
        arabic: "يا مَنْ لا يَزيدُ في مُلْكِهِ شَيْءٌ يا مَنْ لا يَخْفى عَلَيْهِ شَيْءٌ يا مَنْ لا يَنْقُصُ مِنْ خَزائِنِهِ شَيْءٌ",
        german: "o Jener, Dessen Königreich nichts vermehrt, o Jener, Dem nichts verborgen bleibt, o Jener, von Dessen Schätze nichts vermindern kann,",
        slideNumber: "92"
    },
    {
        arabic: "يا مَنْ لَيْسَ كَمِثْلِهِ شَيْءٌ يا مَنْ لا يَعْزُبُ عَنْ عِلْمِهِ شَيءٌ",
        german: "o Jener, Dem nichts gleicht, o Jener, Dessen Wissen nichts entgeht,",
        slideNumber: "92"
    },
    {
        arabic: "يا مَنْ هُوَ خَبيرٌ بِكُلِّ شَيْءٍ يا مَنْ وَسِعَتْ رَحْمَتُهُ كُلَّ شَيْءٍ",
        german: "o Jener, Der über alles erfahren ist, o Jener, Dessen Gnade alles umschlossen hat.",
        slideNumber: "92"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْئَلُكَ بِاسْمِكَ يا مُكْرِمُ يا مُطْعِمُ يا مُنْعِمُ يا مُعْطي",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Großzügiger, o Speisender, o Wohltätiger, o Gebender,",
        slideNumber: "93"
    },
    {
        arabic: "يا مُغْني يا مُقْني يا مُفْني يا مُحْيي يا مُرْضي يا مُنْجي",
        german: "o Bereicherer, o Besitzverleiher, o Vernichter, o Lebensschenker, o Zufriedenstellender, o Retter.",
        slideNumber: "93"
    },
    {
        arabic: "يا اَوَّلَ كُلِّ شَيْءٍ وَآخِرَهُ يا اِلـهَ كُلِّ شَيْءٍ وَمَليكَهُ يا رَبَّ كُلِّ شَيْءٍ وَصانِعَهُ",
        german: "o Anfang aller Dinge und deren Ende, o Gott aller Dinge und deren Herrscher, o Herr aller Dinge und deren Gestalter,",
        slideNumber: "94"
    },
    {
        arabic: "يا بارئَ كُلِّ شَيْءٍ وَخالِقَهُ يا قابِضَ كُلِّ شَيْءٍ وَباسِطَهُ يا مُبْدِئَ كُلِّ شَيْءٍ وَمُعيدَهُ",
        german: "o Urheber aller Dinge und deren Schöpfer, o Begrenzer aller Dinge und deren Ausbreiter, o Ursprunggeber aller Dinge und deren Wiederbringer,",
        slideNumber: "94"
    },
    {
        arabic: "يا مُنْشِئَ كُلِّ شَيْءٍ وَمُقَدِّرَهُ يا مُكَوِّنَ كُلِّ شَيْءٍ وَمُحَوِّلَهُ",
        german: "o Erschaffer aller Dinge und deren Bemesser, o Former aller Dinge und deren Umwandler,",
        slideNumber: "94"
    },
    {
        arabic: "يا مُحْيِيَ كُلِّ شَيْءٍ وَمُميتَهُ يا خالِقَ كُلِّ شَيْءٍ وَوارِثَهُ",
        german: "o Lebensspender aller Dinge und deren Lebensnehmer, o Schöpfer aller Dinge und deren Erbe.",
        slideNumber: "94"
    },
    {
        arabic: "يا خَيْرَ ذاكِرٍ وَمَذْكُورٍ يا خَيْرَ شاكِرٍ وَمَشْكُورٍ يا خَيْرَ حامِدٍ وَمَحْمُودٍ",
        german: "o wohltätigster Erwähnender und Erwähnter, o wohltätigster Dankender und Bedankter, o wohltätigster Lobender und Gelobter,",
        slideNumber: "95"
    },
    {
        arabic: "يا خَيْرَ شاهِدٍ وَمَشْهُودٍ يا خَيْرَ داعٍ وَمَدْعُوٍّ يا خَيْرَ مُجيبٍ وَمُجابٍ",
        german: "o wohltätigster Zeuge und Bezeugter, o wohltätigster Einladender und Geladener, o wohltätigster Erfüllender und Dem entsprochen wird,",
        slideNumber: "95"
    },
    {
        arabic: "يا خَيْرَ مُؤنِسٍ وَاَنيسٍ يا خَيْرَ صاحِبٍ وَجَليسٍ",
        german: "o wohltätigster Gefährtenleitender und Gefährte, o wohltätigster Begleiter und Gesellschaft Leistender,",
        slideNumber: "95"
    },
    {
        arabic: "يا خَيْرَ مَقْصُودٍ وَمَطْلُوبٍ يا خَيْرَ حَبيبٍ وَمَحْبُوبٍ",
        german: "o wohltätigstes Ziel und Erwünschter, o wohltätigster Liebender und Geliebter.",
        slideNumber: "95"
    },
    {
        arabic: "يا مَنْ هُوَ لِمَنْ دَعاهُ مُجيبٌ يا مَنْ هُوَ لِمَنْ اَطاعَهُ حَبيبٌ",
        german: "o Jener, Der jenen, die Ihn rufen, antwortet, o Jener, Der von jenen, die Ihm gehorchen, geliebt wird,",
        slideNumber: "96"
    },
    {
        arabic: "يا مَنْ هُوَ اِلى مَنْ اَحَبَّهُ قَريبٌ يا مَنْ هُوَ بِمَنِ اسْتَحْفَظَهُ رَقيبٌ",
        german: "o Jener, Der jenen, die Ihn lieben, nahe ist, o Jener, Der jene, die Ihn um Behütung bitten, bewacht,",
        slideNumber: "96"
    },
    {
        arabic: "يا مَنْ هُوَ بِمَنْ رَجاهُ كَريمٌ يا مَنْ هُوَ بِمَنْ عَصاهُ حَليمٌ",
        german: "o Jener, Der gegenüber jenen, die auf Ihn hoffen, großzügig ist, o Jener, Der nachsichtig mit jenen ist, die ihm gegenüber ungehorsam sind,",
        slideNumber: "96"
    },
    {
        arabic: "يا مَنْ هُوَ في عَظَمَتِهِ رَحيمٌ يا مَنْ هُوَ في حِكْمَتِهِ عَظيمٌ",
        german: "o Jener, Der in Seiner Größe barmherzig ist, o Jener, Der in Seiner Weisheit groß ist,",
        slideNumber: "96"
    },
    {
        arabic: "يا مَنْ هُوَ في اِحْسانِهِ قَديمٌ يا مَنْ هُوَ بِمَنْ اَرادَهُ عَليمٌ",
        german: "o Jener, Der in Seiner Güte ohne Anfang ist, o Jener, Der um jene weiß, die Ihn erstreben.",
        slideNumber: "96"
    },
    {
        arabic: "اَللّـهُمَّ اِنّي اَسْأَلُكَ بِاسْمِكَ يا مُسَبِّبُ يا مُرَغِّبُ يا مُقَلِّبُ",
        german: "Allah unser, ich flehe Dich mit Deinem Namen an: o Verursacher, o Erweckender von Begehren, o Prüfer,",
        slideNumber: "97"
    },
    {
        arabic: "يا مُعَقِّبُ يا مُرَتِّبُ يا مُخَوِّفُ يا مُحَذِّرُ يا مُذَكِّرُ يا مُسَخِّرُ يا مُغَيِّرُ",
        german: "o Verfolger, o Ordner, o Angsteinflößender, o Warnender, o Erinnernder, o Unterwerfer, o Verändernder.",
        slideNumber: "97"
    },
    {
        arabic: "يا مَنْ عِلْمُهُ سابِقٌ يا مَنْ وَعْدُهُ صادِقٌ يا مَنْ لُطْفُهُ ظاهِرٌ",
        german: "o Jener, Dessen Wissen schon früher existiert, o Jener, Dessen Versprechen aufrichtig ist, o Jener, Dessen Nachsicht offensichtlich ist,",
        slideNumber: "98"
    },
    {
        arabic: "يا مَنْ اَمْرُهُ غالِبٌ يا مَنْ كِتابُهُ مُحْكَمٌ يا مَنْ قَضاؤُهُ كأئِنٌ",
        german: "o Jener, Dessen Befehl siegreich ist, o Jener, Dessen Buch unmissverständlich ist, o Jener, Dessen Richtsspruch existiert",
        slideNumber: "98"
    },
    {
        arabic: "يا مَنْ قُرآنُهُ مَجيدٌ يا مَنْ مُلْكُهُ قَديمٌ",
        german: "o Jener, Dessen Qur´an ruhmreich ist, o Jener, Dessen Herrschaft ohne Anfang ist,",
        slideNumber: "98"
    },
    {
        arabic: "يا مَنْ فَضْلُهُ عَميمٌ يا مَنْ عَرْشُهُ عَظيمٌ",
        german: "o Jener, Dessen Huld allgemein ist, o Jener, Dessen Thron herrlich ist.",
        slideNumber: "98"
    },
    {
        arabic: "يا مَنْ لا يَشْغَلُهُ سَمْعٌ عَنْ سَمْعٍ يا مَنْ لا يَمْنَعُهُ فِعْلٌ عَنْ فِعْلٍ",
        german: "o Jener, Den das Hören nicht vom Hören ablenkt, o Jener, Dem keine Tat am Handeln hindert,",
        slideNumber: "99"
    },
    {
        arabic: "يا مَنْ لا يُلْهيهِ قَوْلٌ عَنْ قَوْلٍ يا مَنْ لا يُغَلِّطُهُ سُؤالٌ عَنْ سُؤالٍ",
        german: "o Jener, Den das Aussprechen nicht vom Aussprechen abhält, o Jener, Der durch Fragen nicht vom Fragen abgebracht wird",
        slideNumber: "99"
    },
    {
        arabic: "يا مَنْ لا يَحْجُبُهُ شَيْءٌ عَنْ شَيْءٍ يا مَنْ لا يُبْرِمُهُ اِلْحاحُ الْمُلِحّينَ",
        german: "o Jener, Der nicht von etwas abgeschirmt wird durch etwas anderes, o Jener, Der durch das Drängen der Beharrlichen nicht überdrüssig wird,",
        slideNumber: "99"
    },
    {
        arabic: "يا مَنْ هُوَ غايَةُ مُرادِ الْمُريدينَ",
        german: "o Jener, Der der Beweggrund der Begehrenden ist",
        slideNumber: "99"
    },
    {
        arabic: "يا مَنْ هُوَ مُنْتَهى هِمَمِ الْعارِفينَ يا مَنْ هُوَ مُنْتَهى طَلَبِ الطّالِبينَ",
        german: "o Jener, Der das Endziel des Willens der Wissenden ist, o Jener, Der das Endziel des Strebens der Strebenden ist,",
        slideNumber: "99"
    },
    {
        arabic: "يا مَنْ لا يَخْفى عَلَيْهِ ذَرَّةٌ فِي الْعالَمينَ",
        german: "o Jener, Dem kein Atom in den Welten verborgen ist.",
        slideNumber: "99"
    },
    {
        arabic: "يا حَليماً لا يَعْجَلُ يا جَواداً لا يَبْخَلُ يا صادِقاً لا يُخْلِفُ",
        german: "o Nachsichtiger, Der es nicht eilig hat, o Großzügiger, Der nicht geizig ist, o Wahrhaftiger, Der sein Versprechen nicht bricht,",
        slideNumber: "100"
    },
    {
        arabic: "يا وَهّاباً لا يَمَلُّ يا قاهِراً لا يُغْلَبُ يا عَظيماً لا يُوصَفُ",
        german: "o Schenker, Der nicht verdrossen wird, o Bezwinger, Der nicht besiegt wird, o Gewaltiger, Der nicht beschreibbar ist,",
        slideNumber: "100"
    },
    {
        arabic: "يا عَدْلاً لا يَحيفُ يا غَنِيّاً لا يَفْتَقِرُ يا كَبيراً لا يَصْغُرُ يا حافِظاً لا يَغْفَلُ.",
        german: "o Gerechter, Der nicht ungerecht wird, o Reicher, Der nicht verarmt, o Großer, Der nicht klein wird, o Behüter, Der nicht vernachlässigt.",
        slideNumber: "100"
    }
];

let collectedArray = [];

for ( let i = 0; i < dua.length; i++ ) {
    const tempArray = [];

    let slideNumber = dua[i].slideNumber;
    console.log('slideNumber: ', slideNumber);
    let j = i;
    console.log('starting at: ', j);
    
    while ( j < dua.length && dua[j].slideNumber === slideNumber ) {
        tempArray.push({...dua[j]})
        console.log('j matched: ', tempArray);
        j++;
    }

    collectedArray.push([...tempArray]);
    i = --j;
}

*/