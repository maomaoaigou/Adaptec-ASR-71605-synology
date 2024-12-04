plugin.exports = class ShencouPlugin {
    // 插件基本信息
    static ID = "shencou-light-novel";
    static TYPE = plugin.type.BOOK_SOURCE;
    static GROUP = "轻小说";
    static NAME = "神凑轻小说";
    static VERSION = "1.0";
    static VERSION_CODE = 1;
    static BASE_URL = "https://m.shencou.com";
    static PLUGIN_FILE_URL = "https://raw.githubusercontent.com/your-repo/shencou-plugin/main/dist/shencou.js";  // 添加这行
    static REQUIRE = {};

    constructor({request, store, cheerio, nanoid}) {
        this.request = request;    // HTTP请求工具
        this.store = store;        // 数据存储工具
        this.cheerio = cheerio;    // HTML解析工具
        this.nanoid = nanoid;      // ID生成工具
    }

    async search(keyword) {
        const url = `${ShencouPlugin.BASE_URL}/pserchs.php`;
        const response = await this.request.post(url, {
            body: `s=${keyword}&type=articlename&submit`,
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36"
            },
            charset: "gbk"
        });

        const $ = this.cheerio(response.body, {decodeEntities: false});
        let books = [];

        $('.search_list').each((i, elem) => {
            const $elem = this.cheerio(elem);
            const $link = $elem.find('a');
            const href = $link.attr('href');
            const aid = href.match(/[0-9]+/)[0];
            
            books.push({
                bookname: $link.eq(0).text().replace(/《|》/g, ''),
                author: $link.eq(2).text(),
                coverImageUrl: this.generateCoverUrl(aid),
                detailPageUrl: ShencouPlugin.BASE_URL + href,
                kind: $link.eq(1).text().replace(/�/g, '文库')
            });
        });

        return books;
    }

    generateCoverUrl(aid) {
        const prefix = String(aid).length > 3 ? String(aid)[0] : "0";
        return `http://www.shencou.com/files/article/image/${prefix}/${aid}/${aid}s.jpg`;
    }

    async getDetail(url) {
        const response = await this.request.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36"
            }
        });

        const $ = this.cheerio(response.body, {decodeEntities: false});
        const chapters = [];

        $('.info_chapters .p2:nth-of-type(2) li:not(.warning)').each((i, elem) => {
            const $elem = this.cheerio(elem);
            if ($elem.find('a').length > 0) {
                $elem.find('a').each((_, a) => {
                    const $a = this.cheerio(a);
                    chapters.push({
                        title: $a.text().match(/>(.*)$/)[1],
                        url: ShencouPlugin.BASE_URL + $a.attr('href'),
                        isVolume: false
                    });
                });
            } else {
                chapters.push({
                    title: " 🏷️ " + $elem.text(),
                    isVolume: true
                });
            }
        });

        return {
            bookname: $('.inh1').text(),
            author: $('.p1').eq(0).text(),
            coverImageUrl: $('.tu img').attr('src'),
            intro: $('.jj .p2').text().replace(/经费不足[\s\S]+/, ''),
            kind: [
                $('.catalog1 .p4').text(),
                $('.p5').text(),
                $('.p2').eq(1).text().replace(/：/, ':')
            ].join(','),
            wordCount: $('.p6').text(),
            latestChapterTitle: $('.info_chapters .p2').eq(0).find('li').eq(0).text(),
            chapterList: chapters
        };
    }

    async getTextContent(chapter) {
        const response = await this.request.get(chapter.url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 9) Mobile Safari/537.36"
            }
        });

        const $ = this.cheerio(response.body, {decodeEntities: false});
        return $('#novelcontent')
            .html()
            .replace(/\s*（插图\d+）\s*/g, '');
    }

    async explore() {
        const topResponse = await this.request.get(`${ShencouPlugin.BASE_URL}/top.php?type=allvisit&page=1`);
        const tagResponse = await this.request.get(`${ShencouPlugin.BASE_URL}/sort.php`);
        
        const results = [];
        if (topResponse && tagResponse) {
            const $top = this.cheerio(topResponse.body);
            const $tag = this.cheerio(tagResponse.body);

            results.push({ title: "排行榜", size: 1 });
            $top.find('.ranking a').each((_, elem) => {
                const $elem = this.cheerio(elem);
                results.push({
                    title: $elem.text(),
                    url: $elem.attr('href').replace('1', '{{page}}'),
                    size: 0.25
                });
            });

            results.push({ title: "分类", size: 1 });
            $tag.find('.sortlist a').each((_, elem) => {
                const $elem = this.cheerio(elem);
                results.push({
                    title: $elem.text(),
                    url: $elem.attr('href').replace('1', '{{page}}'),
                    size: 0.4
                });
            });
        }
        
        return results;
    }
};
