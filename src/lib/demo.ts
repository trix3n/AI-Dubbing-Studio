import type { Project, Segment } from "../types/studio";
export const demoProject: Project = {
  id: "interview-01",
  name: "A conversation about creativity",
  segments: [
    {
      id: "01",
      start: 0,
      end: 7.4,
      speaker: "Speaker 1",
      original: "Расскажите, с чего начался ваш путь в творчестве?",
      translation:
        "Bạn có thể chia sẻ hành trình sáng tạo của mình bắt đầu như thế nào không?",
      voice: "Callirrhoe",
      status: "Reviewed",
    },
    {
      id: "02",
      start: 7.4,
      end: 18.8,
      speaker: "Speaker 2",
      original:
        "Всё началось с любопытства. Мне всегда хотелось понять, как устроен мир вокруг нас.",
      translation:
        "Mọi thứ bắt đầu từ sự tò mò. Tôi luôn muốn hiểu thế giới xung quanh chúng ta vận hành như thế nào.",
      voice: "Algieba",
      status: "Draft",
    },
    {
      id: "03",
      start: 18.8,
      end: 26.2,
      speaker: "Speaker 1",
      original: "А что вдохновляет вас сегодня? Изменилось ли это со временем?",
      translation:
        "Vậy điều gì truyền cảm hứng cho bạn ngày hôm nay? Điều đó có thay đổi theo thời gian không?",
      voice: "Callirrhoe",
      status: "Draft",
    },
    {
      id: "04",
      start: 26.2,
      end: 38,
      speaker: "Speaker 2",
      original:
        "Люди и их истории. В каждом разговоре можно найти что-то удивительное.",
      translation:
        "Con người và những câu chuyện của họ. Trong mỗi cuộc trò chuyện, ta đều có thể tìm thấy điều kỳ diệu.",
      voice: "Algieba",
      status: "Draft",
    },
  ],
};
export function timestamp(seconds: number, srt = false) {
  return new Date(Math.round(seconds * 1000))
    .toISOString()
    .slice(srt ? 11 : 14, 23)
    .replace(".", srt ? "," : ".");
}
export function toSrt(segments: Segment[]) {
  return (
    segments
      .map(
        (s, i) =>
          `${i + 1}\n${timestamp(s.start, true)} --> ${timestamp(s.end, true)}\n${s.translation}`,
      )
      .join("\n\n") + "\n"
  );
}
export function validateMedia(name: string, size: number) {
  if (!/\.(mp4|mp3|wav|m4a)$/i.test(name))
    return "Choose an MP4, MP3, WAV, or M4A file.";
  if (size > 500 * 1024 * 1024)
    return "Please choose a file smaller than 500 MB.";
  if (size === 0) return "This file is empty.";
  return null;
}
