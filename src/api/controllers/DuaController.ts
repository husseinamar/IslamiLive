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

import { readFile, writeFile } from 'fs/promises'
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import { ImportDuaFromJSONFileRequest } from './requests/Dua/ImportDuaFromJSONFileRequest';
import { DuaJSON } from '../models/DuaJSON';

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

            if ( line[createParam.germanTextIdentifier] ) {
                german = line[createParam.germanTextIdentifier];
            }

            if ( line[createParam.arabicTextIdentifier] ) {
                arabic = line[createParam.arabicTextIdentifier];
            }

            const newVerse = new DuaVerse();
            newVerse.arabic = arabic;
            newVerse.german = german;
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

            if ( line[json.germanTextIdentifier] ) {
                german = line[json.germanTextIdentifier];
            }

            if ( line[json.arabicTextIdentifier] ) {
                arabic = line[json.arabicTextIdentifier];
            }

            const newVerse = new DuaVerse();
            newVerse.arabic = arabic;
            newVerse.german = german;
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

        const OUTFILE = path.join(__dirname, '../../..', 'public/generated/Dua/pdf/') + duaChapterParam.folderName + duaChapter.name;
        await this.createPDFPuppeteer(OUTFILE, {
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

    private async createPDFPuppeteer(output: string, content: any): Promise<any> {
        const assets = {
            background: {
                src: ('../files/Templates/3-dua-iftitah-2023/dua-iftitah-2023.jpg'),
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
    
        await ejs.renderFile(path.join(__dirname, '../../..', 'views/Dua/slide-iftitah.ejs'), {assets, content}, async (err: any, data) => {
            const page = await browser.newPage();

            const file = path.join(__dirname, '../../..', 'public') + '/pages/slide.html';
            console.log('file://' + file);
            
            await writeFile(file, data);

            await page.goto('file://' + file);
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
    
            console.log("done");
            await browser.close();
        });
    
    }
}