-- 학습 자료 본문 한도 10,000자 → 30,000자(#144, 04 기능 명세 9번 "학습 자료").
-- 수업 자료 파일(PDF·PPT·한글)을 글로 바꿔 넣으면 10,000자를 쉽게 넘는다. 프로젝트 README는 10,000자 그대로다.
-- 길이는 이 CHECK만 본다(create_note는 길이를 따로 보지 않는다)
alter table public.study_notes
  drop constraint study_notes_content_check,
  add constraint study_notes_content_check check (char_length(content) between 30 and 30000);
