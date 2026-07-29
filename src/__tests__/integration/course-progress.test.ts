// COURSE-P4-01: Integration test for the course progress flow.
// Exercises CourseService end to end against in-memory state: the reader opens a
// lesson (auto-enrolment), finishes half the course, then finishes the rest.
import { buildTestCourseService } from "../fixtures/services";
import { FakeCourseCatalog }      from "../fixtures/FakeCourseCatalog";

const EMAIL  = "alumna@example.com";
const COURSE = "dl-nlp";

function service() {
  return buildTestCourseService({
    catalog: new FakeCourseCatalog({ [COURSE]: ["pipeline", "tokens", "embeddings", "atencion"] }),
  });
}

describe("Course progress flow", () => {
  it("auto-enrols on first view, then tracks completion percentage", async () => {
    const { service: courses } = service();

    await courses.markLessonSeen(EMAIL, COURSE, "pipeline");

    const opened = await courses.getCourseProgress(EMAIL, COURSE);
    expect(opened.enrolledAt).not.toBeNull();
    expect(opened.totalLessons).toBe(4);
    expect(opened.completedLessons).toBe(0);
    expect(opened.lastSeenLessonSlug).toBe("pipeline");

    await courses.markLessonCompleted(EMAIL, COURSE, "pipeline");
    await courses.markLessonCompleted(EMAIL, COURSE, "tokens");

    const halfway = await courses.getCourseProgress(EMAIL, COURSE);
    expect(halfway.completedLessons).toBe(2);
    expect(halfway.percentComplete).toBe(50);
    expect(halfway.completedAt).toBeNull();

    await courses.markLessonCompleted(EMAIL, COURSE, "embeddings");
    await courses.markLessonCompleted(EMAIL, COURSE, "atencion");

    const done = await courses.getCourseProgress(EMAIL, COURSE);
    expect(done.percentComplete).toBe(100);
    expect(done.completedAt).not.toBeNull();
  });

  it("surfaces the same course through listEnrollments", async () => {
    const { service: courses } = service();

    await courses.markLessonCompleted(EMAIL, COURSE, "pipeline");

    const summaries = await courses.listEnrollments(EMAIL);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      courseSlug:       COURSE,
      totalLessons:     4,
      completedLessons: 1,
      percentComplete:  25,
    });
  });

  it("survives a bookmark to a lesson that no longer exists", async () => {
    const { service: courses } = service();

    await expect(courses.markLessonSeen(EMAIL, COURSE, "leccion-renombrada"))
      .resolves.toBeUndefined();

    expect(await courses.listEnrollments(EMAIL)).toEqual([]);
  });
});
